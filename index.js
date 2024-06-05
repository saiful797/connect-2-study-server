require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const app = express();
const cors = require('cors');
const { param } = require('express/lib/request');
const port = process.env.PORT || 9000;

//middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.a3qxp45.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db('connect2studyDB').collection('users');
    const studySessionCollection = client.db('connect2studyDB').collection('studySessions');

    //user related api
    app.post('/users', async( req, res ) => {
      const user = req.body;
      const query = { email: user.email};
      const existingUser = await usersCollection.findOne(query);

      if(existingUser){
        if(existingUser){
          return res.send({message: 'User already exist', insertedId: null})
        }
      }

      const result = await usersCollection.insertOne(user);
      res.send( result );
    })

    // tutor related api
    app.get('/tutors', async (req, res) =>{
      const query = { role: 'tutor' };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    })
    app.get('/study-session', async ( req, res ) => {
      const result = await studySessionCollection.find().toArray();
      res.send( result );
    })

    app.get('/all-sessions/:email', async ( req, res ) => {
      const query = { email: req.params.email };
      // console.log({email: req.params.email});
      const result = await studySessionCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/study-session', async ( req, res ) => {
      const sessionInfo = req.body;
      const result = await studySessionCollection.insertOne(sessionInfo);
      res.send(result);
    })

    // user role api
    app.get('/role/:email', async (req, res) => {
      const email = req.params.email;
      const  query = {email: email}
      const result = await usersCollection.findOne( query );
      res.send(result);
    })

    // Admin related api
    app.get('/allUsers', async( req, res ) => {
      const result = await usersCollection.find().toArray();
      res.send( result );
    })

    app.get("/allStudySessions", async ( req, res ) => {
       const result = await studySessionCollection.find().sort({ "_id": -1 }).toArray();
       res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

//check connection to mongodb server
app.get('/', (req, res) => {
    res.send('Connect 2 study server is running.....');
})

app.listen(port, () => {
    console.log(`Connect 2 study server is on port ${port}`);
})