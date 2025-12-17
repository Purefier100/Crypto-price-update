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

/* -----------------------------
   Cache CoinGecko Market Data
------------------------------*/
let markets = [];

async function loadMarkets() {
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
        markets = res.data;
        console.log("✅ CoinGecko data loaded");
    } catch (err) {
        console.error("CoinGecko error:", err.message);
    }
}

// initial + refresh every 5 mins
loadMarkets();
setInterval(loadMarkets, 5 * 60 * 1000);

/* -----------------------------
   Routes
------------------------------*/
app.get("/", (req, res) => {
    res.render("index", { data: null, error: null });
});

app.get("/price", (req, res) => {
    const input = req.query.symbol?.trim().toLowerCase();
    if (!input) {
        return res.render("index", {
            data: null,
            error: "Enter a coin symbol",
        });
    }

    const coin = markets.find(
        c =>
            c.symbol.toLowerCase() === input ||
            c.name.toLowerCase() === input
    );

    if (!coin) {
        return res.render("index", {
            data: null,
            error: "Coin not found on CoinGecko",
        });
    }

    res.render("index", {
        data: {
            name: coin.name,
            symbol: coin.symbol.toUpperCase(),
            price: coin.current_price,
            change: coin.price_change_percentage_24h,
            logo: coin.image,
            tradingView: `COINBASE:${coin.symbol.toUpperCase()}USD`,
        },
        error: null,
    });
});

app.listen(PORT, () =>
    console.log(`✅ Server running at http://localhost:${PORT}`)
);








