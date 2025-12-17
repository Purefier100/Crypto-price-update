import express from "express";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000; // ✅ use Vercel's port

// Static + Views
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// -------------------------
// Load all coins from CoinGecko
// -------------------------
let allCoins = [];

async function loadAllCoins() {
    try {
        const response = await axios.get(
            "https://api.coingecko.com/api/v3/coins/list"
        );
        allCoins = response.data; // [{id, symbol, name}, ...]
        console.log(`✅ Loaded ${allCoins.length} coins from CoinGecko`);
    } catch (err) {
        console.error("Failed to load coins:", err.message);
    }
}

// Load on startup
await loadAllCoins();

// Refresh coin list every 24h
setInterval(loadAllCoins, 24 * 60 * 60 * 1000);

// -------------------------
// Routes
// -------------------------
app.get("/", (req, res) => {
    res.render("index", { data: null, error: null });
});

app.get("/price", async (req, res) => {
    const input = req.query.symbol?.trim();

    if (!input) {
        return res.render("index", {
            data: null,
            error: "Enter a coin symbol or token address",
        });
    }

    const symbol = input.toLowerCase();
    const isAddress = input.startsWith("0x") && input.length === 42;

    try {
        // ------------------------- CoinGecko Dynamic Search -------------------------
        if (!isAddress) {
            const coin = allCoins.find((c) => c.symbol.toLowerCase() === symbol);
            if (coin) {
                const cg = await axios.get(
                    `https://api.coingecko.com/api/v3/coins/${coin.id}`
                );

                return res.render("index", {
                    data: {
                        name: cg.data.name,
                        symbol: cg.data.symbol.toUpperCase(),
                        price: cg.data.market_data.current_price.usd,
                        change: cg.data.market_data.price_change_percentage_24h,
                        logo: cg.data.image.large,
                        network: "Multiple",
                        chartSymbol: `${cg.data.symbol.toUpperCase()}USD`,
                    },
                    error: null,
                });
            }
        }

        // ------------------------- DexScreener Fallback -------------------------
        const dex = await axios.get(
            `https://api.dexscreener.com/latest/dex/tokens/${input}`
        );

        const pairs = dex.data.pairs;
        if (!pairs || pairs.length === 0) throw new Error();

        const best = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];

        return res.render("index", {
            data: {
                name: best.baseToken.name,
                symbol: best.baseToken.symbol,
                price: best.priceUsd,
                change: best.priceChange?.h24 || 0,
                logo: best.baseToken.logoURI,
                network: best.chainId.toUpperCase(),
                chartSymbol: null,
            },
            error: null,
        });
    } catch (err) {
        return res.render("index", { data: null, error: "Coin or token not found" });
    }
});

// ------------------------- Start Server
// -------------------------
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

export default app; // optional for some Vercel setups
