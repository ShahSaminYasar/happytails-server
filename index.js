const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
app.use(express.json());
app.use(cors());

dotenv.config();

const PORT = process.env.PORT || 5000;

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const db = client.db("happyTails");
const petsCollection = db.collection("pets");

async function run() {
  try {
    await client.connect();

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(
    `<body style="margin: 0; padding: 0; box-sizing: border-box; height: 100vh; background: #000; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; font-size: 1.5rem; box-sizing: border-box;"><h1>Welcome to Happy Tails' server 🐾</h1></body>`,
  );
});

app.listen(PORT, () => {
  console.log(`Happy Tails server is running on port ${PORT}`);
});
