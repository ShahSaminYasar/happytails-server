const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:3000", "https://ssy-happytails.vercel.app"],
    credentials: true,
  }),
);

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

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    console.log(payload);
    next();
  } catch (error) {
    return res.status(403).json({ message: "Forbidden" });
  }
};

async function run() {
  try {
    await client.connect();

    app.get("/pets", async (req, res) => {
      const { name, species, ownerEmail, limit } = req.query;
      const query = {};

      if (name) query.name = { $regex: name, $options: "i" };
      if (species) query.species = { $in: species.split(",") };
      if (ownerEmail) query.ownerEmail = ownerEmail;

      const pets = await petsCollection
        .find(query)
        .limit(limit ? parseInt(limit) : 0)
        .toArray();
      res.json(pets);
    });

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
