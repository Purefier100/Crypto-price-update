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

// Load Bybit tickers
let bybitTickers = [];

async function loadBybitTickers() {
    try {
        const response = await axios.get("https://api.bybit.com/v5/market/tickers", {
            params: { category: "spot" }
        });

        // Example response structure: { retCode, result: { list: [ { symbol, lastPrice, price24hPcnt }, ... ] } }
        if (response.data.result && response.data.result.list) {
            bybitTickers = response.data.result.list;
            console.log(`✅ Loaded ${bybitTickers.length} spot tickers from Bybit`);
        }
    } catch (err) {
        console.error("Failed to load Bybit tickers:", err.message);
    }
}

loadBybitTickers();
setInterval(loadBybitTickers, 5 * 60 * 1000); // refresh every 5 mins

// Optional: load CoinGecko list for logos
let coinGeckoList = [];
async function loadCoinGeckoList() {
    try {
        const cgRes = await axios.get("https://api.coingecko.com/api/v3/coins/list");
        coinGeckoList = cgRes.data; // [{ id, symbol, name }]
        console.log("Loaded CoinGecko coin list for logo matching");
    } catch (err) {
        console.error("Failed to load CoinGecko list:", err.message);
    }
}

loadCoinGeckoList();

// Helper to get logo from CoinGecko by symbol
async function fetchLogoBySymbol(symbol) {
    try {
        const coin = coinGeckoList.find(c => c.symbol.toLowerCase() === symbol.toLowerCase());
        if (coin) {
            const cgDetail = await axios.get(`https://api.coingecko.com/api/v3/coins/${coin.id}`);
            return cgDetail.data.image.large;
        }
    } catch (err) {
        // ignore if not found
    }
    return null;
}

app.get("/", (req, res) => {
    res.render("index", { data: null, error: null });
});

app.get("/price", async (req, res) => {
    const input = req.query.symbol?.trim();
    if (!input) return res.render("index", { data: null, error: "Enter coin symbol" });

    const symbol = input.toUpperCase();

    try {
        const ticker = bybitTickers.find(t => t.symbol.toUpperCase() === symbol || t.symbol.toUpperCase().startsWith(symbol));
        if (!ticker) throw new Error("Pair not found on Bybit");

        let logo = await fetchLogoBySymbol(symbol.replace(/USDT$/i, "")); // try match token symbol for logo

        const data = {
            name: ticker.symbol,
            symbol: ticker.symbol,
            price: ticker.lastPrice,
            change: (ticker.price24hPcnt * 100).toFixed(2), // convert decimal to %
            logo: logo,
            network: "Bybit Spot",
            chartSymbol: `${ticker.symbol.replace(/USDT$/i, "")}USD` // tradingview if applicable
        };

        res.render("index", { data, error: null });
    } catch (err) {
        res.render("index", { data: null, error: "Coin not found on Bybit" });
    }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));




