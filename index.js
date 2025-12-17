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
// Load top coins from CoinGecko
// -------------------------
let allCoins = [];

async function loadAllCoins() {
    try {
        const response = await axios.get("https://api.coingecko.com/api/v3/coins/markets", {
            params: {
                vs_currency: "usd",
                order: "market_cap_desc",
                per_page: 250,  // max per page
                page: 1,
                sparkline: false,
            },
        });
        allCoins = response.data; // contains price, symbol, logo, name, 24h change
        console.log(`✅ Loaded ${allCoins.length} coins from CoinGecko`);
    } catch (err) {
        console.error("Failed to load CoinGecko coins:", err.message);
    }
}

// Initial load and refresh every 5 minutes
loadAllCoins();
setInterval(loadAllCoins, 5 * 60 * 1000);

// -------------------------
// Routes
// -------------------------
app.get("/", (req, res) => {
    res.render("index", { data: null, error: null });
});

app.get("/price", async (req, res) => {
    const input = req.query.symbol?.trim();
    if (!input) return res.render("index", { data: null, error: "Enter a symbol or token address" });

    const symbol = input.toLowerCase();
    const isAddress = input.startsWith("0x") && input.length === 42;

    try {
        let coinData = null;

        // ------------------------- CoinGecko search (by symbol) -------------------------
        if (!isAddress) {
            const coin = allCoins.find((c) => c.symbol.toLowerCase() === symbol);
            if (coin) {
                coinData = {
                    name: coin.name,
                    symbol: coin.symbol.toUpperCase(),
                    price: coin.current_price,
                    change: coin.price_change_percentage_24h,
                    logo: coin.image,
                    network: "Multiple",
                    chartSymbol: `${coin.symbol.toUpperCase()}USD`,
                };
            }
        }

        // ------------------------- DexScreener fallback (by contract address) -------------------------
        if (!coinData) {
            const dex = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${input}`);
            const pairs = dex.data.pairs;
            if (pairs && pairs.length > 0) {
                // Choose the pair with highest liquidity
                const best = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
                coinData = {
                    name: best.baseToken.name,
                    symbol: best.baseToken.symbol,
                    price: best.priceUsd,
                    change: best.priceChange?.h24 || 0,
                    logo: best.baseToken.logoURI,
                    network: best.chainId.toUpperCase(),
                    chartSymbol: null, // no chart for DEX tokens
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



