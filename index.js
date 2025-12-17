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

// 🔑 Your CoinAPI key
const COINAPI_KEY = "70dcea0e";

// Cache assets from CoinAPI for name lookup
let assetList = [];

// Load assets (name + ID) once
async function loadAssets() {
    try {
        const res = await axios.get("https://rest.coinapi.io/v1/assets", {
            headers: { "X-CoinAPI-Key": COINAPI_KEY }
        });
        assetList = res.data; // array of { asset_id, name, type_is_crypto }
        console.log(`Loaded ${assetList.length} assets from CoinAPI`);
    } catch (err) {
        console.error("Failed to load assets:", err.message);
    }
}

loadAssets();

// Helper to get CoinGecko logo by symbol
async function fetchLogo(symbol) {
    try {
        const cg = await axios.get(
            `https://api.coingecko.com/api/v3/coins/${symbol.toLowerCase()}`
        );
        return cg.data.image.large;
    } catch {
        return null;
    }
}

app.get("/", (req, res) => {
    res.render("index", { data: null, error: null });
});

app.get("/price", async (req, res) => {
    const input = req.query.symbol?.trim().toUpperCase();
    if (!input) return res.render("index", { data: null, error: "Enter a symbol" });

    try {
        // Find asset name
        const asset = assetList.find(a => a.asset_id === input);
        const assetName = asset ? asset.name : input;

        // Get price from CoinAPI
        const priceRes = await axios.get(
            `https://rest.coinapi.io/v1/exchangerate/${input}/USD`,
            { headers: { "X-CoinAPI-Key": COINAPI_KEY } }
        );

        const price = priceRes.data.rate; // current price in USD

        // CoinAPI does not provide 24h change in this endpoint
        const change24h = null; // not available here

        // Get logo from CoinGecko fallback
        const logo = await fetchLogo(input);

        res.render("index", {
            data: {
                name: assetName,
                symbol: input,
                price: price.toFixed(6),
                change: change24h,
                logo,
                network: "CoinAPI",
                chartSymbol: `${input}USD`,
            },
            error: null
        });
    } catch (err) {
        console.error(err.response?.data || err.message);
        res.render("index", { data: null, error: "Coin not found or unsupported" });
    }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));






