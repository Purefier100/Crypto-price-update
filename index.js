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

app.get("/", (req, res) => {
    res.render("index", { data: null, error: null });
});

app.get("/price", async (req, res) => {
    const query = req.query.symbol?.trim().toLowerCase();
    if (!query) {
        return res.render("index", { data: null, error: "Enter a coin name or symbol" });
    }

    try {
        /* 🔍 Search coin */
        const search = await axios.get(
            "https://api.coingecko.com/api/v3/search",
            { params: { query } }
        );

        if (!search.data.coins.length) {
            throw new Error("Coin not found");
        }

        const coinId = search.data.coins[0].id;

        /* 💰 Market data */
        const market = await axios.get(
            "https://api.coingecko.com/api/v3/coins/markets",
            {
                params: {
                    vs_currency: "usd",
                    ids: coinId,
                },
            }
        );

        const coin = market.data[0];

        res.render("index", {
            data: {
                name: coin.name,
                symbol: coin.symbol.toUpperCase(),
                price: coin.current_price,
                change: coin.price_change_percentage_24h,
                logo: coin.image,
                tvSymbol: `COINBASE:${coin.symbol.toUpperCase()}USD`,
            },
            error: null,
        });

    } catch (err) {
        res.render("index", { data: null, error: "Coin not found" });
    }
});

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));






