import express from "express";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Load environment variable for CMC API key
const CMC_API_KEY = process.env.CMC_API_KEY || "da2668580d7548ae9e3ff54712ab19a7";

app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Fetch ALL markets from CoinMarketCap
let coinMarketData = [];

async function loadCMCData() {
    try {
        // 1) Get latest market data (price, percent change, etc.)
        const listings = await axios.get(
            "https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest",
            {
                headers: {
                    "X-CMC_PRO_API_KEY": CMC_API_KEY,
                    Accept: "application/json",
                },
                params: {
                    start: 1,
                    limit: 5000,   // request up to 5000 listings
                    convert: "USD",
                },
            }
        );

        const coins = listings.data.data;

        // 2) Get detailed metadata (logos) for all listings
        const ids = coins.map((c) => c.id).join(",");
        const info = await axios.get(
            "https://pro-api.coinmarketcap.com/v1/cryptocurrency/info",
            {
                headers: {
                    "X-CMC_PRO_API_KEY": CMC_API_KEY,
                    Accept: "application/json",
                },
                params: {
                    id: ids,
                },
            }
        );

        // 3) Merge price + logo
        coinMarketData = coins.map((c) => ({
            id: c.id,
            name: c.name,
            symbol: c.symbol,
            price: c.quote.USD.price,
            change: c.quote.USD.percent_change_24h,
            logo: info.data.data[c.id]?.logo || null,
        }));

        console.log(`Loaded ${coinMarketData.length} coins from CoinMarketCap`);
    } catch (err) {
        console.error("CMC API load error:", err.response?.data || err.message);
    }
}

// Load initially & refresh every 5 minutes
loadCMCData();
setInterval(loadCMCData, 5 * 60 * 1000);

app.get("/", (req, res) => {
    res.render("index", { data: null, error: null });
});

app.get("/price", (req, res) => {
    const input = req.query.symbol?.trim().toUpperCase();
    if (!input) {
        return res.render("index", { data: null, error: "Enter a symbol" });
    }

    const coin = coinMarketData.find(
        (c) => c.symbol.toUpperCase() === input
    );

    if (!coin) {
        return res.render("index", { data: null, error: "Coin not found" });
    }

    res.render("index", {
        data: {
            name: coin.name,
            symbol: coin.symbol,
            price: coin.price.toFixed(6),
            change: coin.change.toFixed(2),
            logo: coin.logo,
            network: "CMC",
            chartSymbol: `${coin.symbol}USD`,
        },
        error: null,
    });
});

app.listen(PORT, () =>
    console.log(`Server running on http://localhost:${PORT}`)
);





