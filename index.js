const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://ssy-happytails.vercel.app",
      "https://www.ssy-happytails.vercel.app",
    ],
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
const requestsCollection = db.collection("requests");
const usersCollection = db.collection("user");

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
    req.email = payload.email;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Forbidden" });
  }
};

async function run() {
  try {
    // await client.connect();

    // Pets
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

    app.get("/pets/:id", async (req, res) => {
      const { id } = req.params;
      const pet = await petsCollection.findOne({ _id: new ObjectId(id) });
      const owner = await usersCollection.findOne(
        { email: pet?.ownerEmail },
        { projection: { name: 1 } },
      );
      res.json({ ...pet, ownerName: owner.name });
    });

    app.post("/pet", verifyToken, async (req, res) => {
      const petData = req.body;

      if (!petData) return res.json({ ok: false, message: "Invalid payload" });

      const result = await petsCollection.insertOne({
        ...petData,
        adopted: false,
      });

      if (result.insertedId) {
        return res.send({
          ok: true,
          message: "Pet post for adoption published successfully",
          id: result?.insertedId,
        });
      } else {
        return res.send({
          ok: false,
          message: "Failed to add adoption post",
        });
      }
    });

    app.patch("/pet/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;

      const result = await petsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: updatedData,
        },
      );

      return res.json(result);
    });

    app.delete("/pet/:id", verifyToken, async (req, res) => {
      const { id } = req.params;

      const result = await petsCollection.deleteOne({ _id: new ObjectId(id) });

      return res.json(result);
    });

    // Requests
    app.post("/requests", verifyToken, async (req, res) => {
      const { name, email, petId, pickupDate, message } = req.body;

      const targetPet = await petsCollection.findOne({
        _id: new ObjectId(petId),
      });

      if (!targetPet)
        return res.status(404).json({ ok: false, message: "Pet not found." });

      if (targetPet.ownerEmail === email)
        return res
          .status(403)
          .json({ ok: false, message: "You cannot adopt your own pet." });

      const checkExisting = await requestsCollection.findOne({
        petId: new ObjectId(petId),
        email,
      });

      if (checkExisting)
        return res.status(400).json({
          ok: false,
          message: "You have already requested for adoption of this pet.",
        });

      const result = await requestsCollection.insertOne({
        petId: new ObjectId(petId),
        name,
        email,
        pickupDate,
        message,
        status: "pending",
      });

      if (result.insertedId) {
        return res.send({
          ok: true,
          message: "Adoption request added successfully",
        });
      } else {
        return res.send({
          ok: false,
          message: "Failed to add adoption request",
        });
      }
    });

    app.get("/requests", verifyToken, async (req, res) => {
      const email = req.email;

      const result = await requestsCollection
        .aggregate([
          {
            $match: {
              email,
            },
          },
          {
            $lookup: {
              from: "pets",
              localField: "petId",
              foreignField: "_id",
              as: "pet",
            },
          },
          {
            $addFields: {
              pet: { $first: "$pet" },
            },
          },
        ])
        .toArray();

      return res.json(result);
    });

    app.delete("/requests", verifyToken, async (req, res) => {
      const { email } = req;
      const { id } = req.body;

      const result = await requestsCollection.deleteOne({
        _id: new ObjectId(id),
        email,
      });

      if (result.deletedCount > 0) {
        return res.json({
          ok: true,
          message: "Adoption request was deleted successfully.",
        });
      } else {
        return res.json({
          ok: false,
          message: "Failed to delete the adoption request.",
        });
      }
    });

    // await client.db("admin").command({ ping: 1 });
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
