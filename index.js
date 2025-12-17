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

/* ------------------------------
   Cache CoinGecko market data
--------------------------------*/
let cgMarkets = [];

async function loadCoinGecko() {
    try {
        const res = await axios.get(
            "https://api.coingecko.com/api/v3/coins/markets",
            {
                params: {
                    vs_currency: "usd",
                    order: "market_cap_desc",
                    per_page: 250,
                    page: 1,
                    sparkline: false,
                },
            }
        );
        cgMarkets = res.data;
        console.log("✅ CoinGecko market data loaded");
    } catch (err) {
        console.error("CoinGecko error:", err.message);
    }
}

// initial + refresh every 5 minutes
loadCoinGecko();
setInterval(loadCoinGecko, 5 * 60 * 1000);

/* ------------------------------
   Routes
--------------------------------*/
app.get("/", (req, res) => {
    res.render("index", { data: null, error: null });
});

app.get("/price", async (req, res) => {
    const input = req.query.symbol?.trim().toLowerCase();
    if (!input) {
        return res.render("index", { data: null, error: "Enter a symbol or contract" });
    }

    const isAddress = input.startsWith("0x") && input.length === 42;

    try {
        /* ------------------------------
           1️⃣ CoinGecko (SYMBOL SEARCH)
        --------------------------------*/
        if (!isAddress) {
            const coin = cgMarkets.find(
                c =>
                    c.symbol.toLowerCase() === input ||
                    c.name.toLowerCase() === input
            );

            if (coin) {
                return res.render("index", {
                    data: {
                        name: coin.name,
                        symbol: coin.symbol.toUpperCase(),
                        price: coin.current_price,
                        change: coin.price_change_percentage_24h,
                        logo: coin.image,
                        network: "CoinGecko",
                    },
                    error: null,
                });
            }
        }

        /* ------------------------------
           2️⃣ DexScreener (FALLBACK)
        --------------------------------*/
        const dex = await axios.get(
            `https://api.dexscreener.com/latest/dex/search?q=${input}`
        );

        const pairs = dex.data.pairs;
        if (!pairs || pairs.length === 0) throw new Error();

        const best = pairs.sort(
            (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        )[0];

        return res.render("index", {
            data: {
                name: best.baseToken.name,
                symbol: best.baseToken.symbol,
                price: best.priceUsd,
                change: best.priceChange?.h24 || 0,
                logo: best.baseToken.logoURI,
                network: best.chainId.toUpperCase(),
            },
            error: null,
        });

    } catch (err) {
        return res.render("index", {
            data: null,
            error: "Token not found",
        });
    }
});

app.listen(PORT, () =>
    console.log(`✅ Server running at http://localhost:${PORT}`)
);







