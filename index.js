import express from "express";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// -------------------------
// Data stores
// -------------------------
let binanceCoins = [];
let dexCoins = [];

// -------------------------
// Load Binance coins
// -------------------------
async function loadBinanceCoins() {
    try {
        const response = await axios.get("https://api.binance.com/api/v3/ticker/24hr");
        binanceCoins = response.data.map((c) => ({
            symbol: c.symbol,
            price: parseFloat(c.lastPrice),
            change: parseFloat(c.priceChangePercent),
            network: "Binance",
            logo: null, // will try to fetch from CoinGecko on demand
        }));
        console.log(`✅ Loaded ${binanceCoins.length} coins from Binance`);
    } catch (err) {
        console.error("Failed to load Binance coins:", err.message);
    }
}

// -------------------------
// Load DEX tokens (Dexscreener)
// -------------------------
async function loadDexCoins() {
    try {
        // Dexscreener doesn’t have a "all tokens" endpoint, we’ll keep it dynamic per request
        dexCoins = []; // empty, will fetch on demand
        console.log("✅ DexCoins ready for dynamic search");
    } catch (err) {
        console.error("Failed to initialize Dex coins:", err.message);
    }
}

// Initial load
loadBinanceCoins();
loadDexCoins();

// Refresh every 5 minutes
setInterval(loadBinanceCoins, 5 * 60 * 1000);

// -------------------------
// Routes
// -------------------------
app.get("/", (req, res) => {
    res.render("index", { data: null, error: null });
});

app.get("/price", async (req, res) => {
    const input = req.query.symbol?.trim();
    if (!input) return res.render("index", { data: null, error: "Enter a symbol or token address" });

    const symbol = input.toUpperCase();
    const isAddress = input.startsWith("0x") && input.length === 42;

    try {
        let coinData = null;

        // ------------------------- Binance search -------------------------
        const binanceCoin = binanceCoins.find((c) => c.symbol === symbol || c.symbol.startsWith(symbol));
        if (binanceCoin) {
            // Try to get logo from CoinGecko
            let logo = null;
            try {
                const cg = await axios.get(`https://api.coingecko.com/api/v3/coins/${symbol.toLowerCase()}`);
                logo = cg.data.image.large;
            } catch {
                logo = null;
            }

            coinData = {
                name: symbol,
                symbol,
                price: binanceCoin.price,
                change: binanceCoin.change,
                logo,
                network: binanceCoin.network,
                chartSymbol: `${symbol}USDT`,
            };
        }

        // ------------------------- DexScreener search for address or unknown -------------------------
        if (!coinData) {
            // Only query Dexscreener if user entered an address or Binance not found
            const dex = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${input}`);
            const pairs = dex.data.pairs;
            if (pairs && pairs.length > 0) {
                const best = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
                coinData = {
                    name: best.baseToken.name,
                    symbol: best.baseToken.symbol,
                    price: best.priceUsd,
                    change: best.priceChange?.h24 || 0,
                    logo: best.baseToken.logoURI,
                    network: best.chainId.toUpperCase(),
                    chartSymbol: null,
                };
            }
        }

        if (!coinData) throw new Error("Coin not found");

        res.render("index", { data: coinData, error: null });
    } catch (err) {
        res.render("index", { data: null, error: "Coin or token not found" });
    }
});

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
