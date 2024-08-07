require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 9000;
const { parse } = require('dotenv');

//middleware
app.use(express.json());
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "https://connect-2-study.web.app",
    "https://connect-2-study.firebaseapp.com",
  ],
  credentials: true,
}));

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
    // await client.connect();
    const usersCollection = client.db('connect2studyDB').collection('users');
    const studySessionCollection = client.db('connect2studyDB').collection('studySessions');
    const notesCollection = client.db('connect2studyDB').collection('notes');
    const sessionsBookedCollection = client.db('connect2studyDB').collection('bookedSessions');
    const reviewsCollection = client.db('connect2studyDB').collection('reviews');
    const sessionMaterialsCollection = client.db('connect2studyDB').collection('sessionMaterials');
    const feedbackCollection = client.db('connect2studyDB').collection('rejectFeedback');
    const paymentsCollection = client.db('connect2studyDB').collection('payments'); 
    const announcementsCollection = client.db('connect2studyDB').collection('announcements'); 

    //jwt related API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '7d'});
      res.send({ token })
    })

    // middlewares
    const verifyToken = (req, res, next) =>{
      // console.log('Inside verifiedToken:  ',req.headers.authorization);

      if(!req.headers.authorization){
          return res.status(401).send({message: 'Unauthorized Access!!!'});
      }

      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err , decoded) => {
          if(err){
              return res.status(401).send({message: 'Unauthorized Access!!!'});
          }
          req.decoded = decoded;
          next();
      })
    }

    // user verify admin after --> (verifyToken)
    const verifyAdmin = async (req, res, next) => {
      const email= req.decoded.email;
      const query = { email: email};
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if(!isAdmin){
          return res.status(403).send({message: "Forbidden Access!!!"})
      }

      next();
    }

    // user verify Tutor after --> (verifyToken)
    const verifyTutor = async (req, res, next) => {
      const email= req.decoded.email;
      const query = { email: email};
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'tutor';
      if(!isAdmin){
          return res.status(403).send({message: "Forbidden Access!!!"})
      }
      next();
    }

    // user verify Tutor after --> (verifyToken)
    const verifyStudent = async (req, res, next) => {
      const email= req.decoded.email;
      const query = { email: email};
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'student';
      if(!isAdmin){
          return res.status(403).send({message: "Forbidden Access!!!"})
      }
      next();
    }

    // Common API for tutor and admin
    app.get('/approved-study-session', async ( req, res ) => {
      const query = { status: 'approved'}
      const result = await studySessionCollection.find(query).toArray();
      res.send( result );
    })

    app.get('/all-announcements', async (req, res) =>{
      const result = await announcementsCollection.find().sort({_id: -1}).toArray();
      res.send(result);
    })

    app.get('/all-free-sessions', async ( req, res ) => {
      const result = await studySessionCollection.find({ regFee:  0 }).toArray();
      res.send( result );
    })

    // check user role status 'admin or not'
    app.get('/users/admin/:email', verifyToken, async ( req, res ) => {
      const email = req.params.email;
      if(email !== req.decoded.email){
          return res.status(403).send({message: 'Forbidden Access!!!'});
      }

      const query = {email: email};
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if(user){
          isAdmin = user?.role === 'admin'
      }

      res.send({ isAdmin});
    })

    // check user role status 'tutor or not'
    app.get('/users/tutor/:email', verifyToken, async ( req, res ) => {
      const email = req.params.email;
      if(email !== req.decoded.email){
          return res.status(403).send({message: 'Forbidden Access!!!'});
      }

      const query = {email: email};
      const user = await usersCollection.findOne(query);
      let isTutor = false;
      if(user){
          isTutor = user?.role === 'tutor'
      }

      res.send({ isTutor});
    })

    // check user role status 'student or not'
    app.get('/users/student/:email', verifyToken, async ( req, res ) => {
      const email = req.params.email;
      if(email !== req.decoded.email){
          return res.status(403).send({message: 'Forbidden Access!!!'});
      }

      const query = {email: email};
      const user = await usersCollection.findOne(query);
      let isStudent = false;
      if(user){
          isStudent = user?.role === 'student'
      }

      res.send({ isStudent});
    })

    app.get('/specific-session/:id', async (req, res) => {
      const query = { _id: new ObjectId ( req.params.id )};
      const result = await studySessionCollection.findOne(query);
      res.send( result );
    })

    app.get('/user/role/:email', async (req, res) => {
      const email = req.params.email;
      const  query = { email: email }
      const result = await usersCollection.findOne( query );
      res.send( result );
    })

    app.patch('/study-session-rejected/:id', async ( req, res ) => {
      const filter = { _id: new ObjectId (req.params.id)};
      const data = req.body;
      const updateStudySession = {
        $set: {
          status: data.status,
        }
      }
      const result = await studySessionCollection.updateOne( filter, updateStudySession );
      res.send(result)
    })

    //user related api
    app.get('/tutors', async (req, res) =>{
      const query = { role: 'tutor' };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    })

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

     // Admin related api
     app.get('/allUsers',verifyToken, verifyAdmin, async( req, res ) => {
      const result = await usersCollection.find().toArray();
      res.send( result );
    })

    app.get('/user-search-by-email/:email', async ( req, res ) => {
      const result = await usersCollection.find({ email: req.params.email }).toArray();
      res.send( result );
    })
    app.get('/user-search-by-name/:name', async ( req, res ) => {
      const result = await usersCollection.find({ name: req.params.name }).toArray();
      res.send( result );
    })

    app.get("/allStudySessions",verifyToken, verifyAdmin, async ( req, res ) => {
      const result = await studySessionCollection.find().sort({ "_id": -1 }).toArray();
      res.send(result);
    })

    app.get('/all-session-material',verifyToken, verifyAdmin, async ( req, res ) => {
      res.send( await sessionMaterialsCollection.find().sort({_id: -1}).toArray());
    })

    app.patch('/study-session-approved/:id' , async ( req, res ) => {
      const filter = { _id: new ObjectId (req.params.id)};
      const data = req.body;
      const regFee = parseFloat(data.regFee);

      const updateStudySession = {
        $set: {
          status: 'approved',
          regFee: regFee,
        }
      }
      const result = await studySessionCollection.updateOne( filter, updateStudySession );
      res.send( result )
    })

    app.post('/admin-rejection-feedback', async ( req, res ) => {
      const result = await feedbackCollection.insertOne(req.body);
      res.send( result );
    })

    app.post('/admin-announcement', async ( req, res ) => {
      const result = await announcementsCollection.insertOne( req.body );
      res.send(result);
    })

    app.patch('/user-role-change/:id' , async ( req, res ) => {
      const filter = {_id: new ObjectId( req.params.id )};
      const data = req.body;
      const updateDoc = {
        $set:{
          role: data.role,
        }
      }
      const result = await usersCollection.updateOne( filter, updateDoc );
      res.send( result );
    })

    app.delete('/study-session-deleted/:id' , async( req, res) => {
      const query = {_id: new ObjectId( req.params.id )};
      const result = await studySessionCollection.deleteOne( query );
      res.send( result );
    })

    app.delete('/specific-study-session-material/:id' , async ( req, res ) => {
      const query = { _id: new ObjectId ( req.params.id )}
      const result = await sessionMaterialsCollection.deleteOne( query );
      res.send(result);
    })

    app.delete('/delete-a-user/:id', async (req, res) => {
      const result = await usersCollection.deleteOne({ _id: new ObjectId ( req.params.id )});
      res.send( result );
    })

    // tutor related api
    app.get('/all-sessions/:email', verifyToken, verifyTutor, async ( req, res ) => {
      const query = { email: req.params.email };
      const result = await studySessionCollection.find(query).sort({ _id: -1 }).toArray();
      res.send(result);
    })

    app.get('/study-session-materials/:email', verifyToken, verifyTutor, async ( req, res ) => {
      const query = { email: req.params.email};
      const result = await sessionMaterialsCollection.find( query ).sort({ _id: -1 }).toArray();
      res.send( result );
    })

    app.get('/material/:id',verifyToken, verifyTutor, async ( req, res ) => {
      const query = {_id: new ObjectId( req.params.id )}
      const result = await sessionMaterialsCollection.findOne( query )
      res.send( result );
    })

    app.get('/session-reject-feedback/:email', async ( req, res ) => {
      const result = await feedbackCollection.find({ email: req.params.email }).toArray();
      res.send( result );
    })

    app.post('/study-session', async ( req, res ) => {
      const sessionInfo = req.body;
      const result = await studySessionCollection.insertOne(sessionInfo);
      res.send(result);
    })

    app.post('/study-session-material' , async ( req, res ) => {
      const result = await sessionMaterialsCollection.insertOne ( req.body );
      res.send(result);
    })

    app.patch('/study-material/:id' , async ( req, res ) =>{
      const filter = {_id: new ObjectId(  req.params.id )};
      const materialData = req.body;
      const materials = {
        $set: {
          ...materialData
        }
      }
      const result = await sessionMaterialsCollection.updateOne( filter, materials );
      res.send( result );
    })

    app.delete('/session-material/:id' , async ( req, res ) => {
      const query = { _id: new ObjectId ( req.params.id )}
      const result = await sessionMaterialsCollection.deleteOne( query );
      res.send(result);
    })

    app.delete('/session-feedback-delete/:id', async ( req, res ) => {
      const result = await feedbackCollection.deleteOne({_id: new ObjectId ( req.params.id )});
      res.send( result );
    })

    //Student related api
    app.get('/student-notes/:email', verifyToken,verifyStudent, async ( req, res ) => {
      const email = req.params.email;
      const query = { email: email }
      const result = await notesCollection.find( query ).toArray()

      res.send( result );
    })

    app.get('/specific-student-notes/:id',  verifyToken,verifyStudent, async( req, res ) => {
      const id = req.params.id;
      const query = {_id: new ObjectId (id)};
      const result = await notesCollection.findOne( query );
      res.send(result);
    })

    app.get('/student-booked-sessions/:email',  verifyToken,verifyStudent, async (req, res ) => {
      const query = { student_email: req.params.email }
      const result = await sessionsBookedCollection.find(query).toArray();
      res.send( result )
    })

    app.get('/booked-session-materials/:id', verifyToken,verifyStudent, async ( req, res ) => {
      const query = { sessionID: req.params.id };
      const result = await sessionMaterialsCollection.find( query ).toArray();
      res.send( result )
    })

    app.post('/student-note', async ( req, res ) => {
      const result = await notesCollection.insertOne( req.body );
      res.send(result);
    })

    app.post('/student-review', async ( req, res ) =>{
      const data = req.body;
      const result = await reviewsCollection.insertOne( data );
      res.send(result);
    })

    app.post('/study-session-booked' , async( req, res ) => {
      const bookedInfo = req.body;
      const result = await sessionsBookedCollection.insertOne( bookedInfo );
      res.send( result )
    })

    app.patch('/update-student-note/:id' , async ( req, res ) => {
      const filter = {_id: new ObjectId ( req.params.id )};
      console.log( filter )
      const data = req.body;
      const updateDoc = {
        $set: {
          ...data,
        }
      }
      const result = await notesCollection.updateOne( filter, updateDoc );
      res.send( result );
    })

    app.delete('/student-note/:id' , async ( req, res ) => {
      const query = { _id: new ObjectId ( req.params.id ) }
      const result = await notesCollection.deleteOne( query );
      res.send( result );
    })


    //TODO: payment system here

    //Payment Intent

    app.post('/create-payment-intent', async ( req, res ) => {
      const { price } = req.body;
      const amount = parseInt( price * 100 );
      const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: [ 'card' ]
      });
      res.send({
          clientSecret: paymentIntent.client_secret
      })
  })

  app.get('/payments/:email', verifyToken, async ( req, res ) => {
      const query = { email: req.params.email }
      if( req.params.email !== req.decoded.email ){
          return res.status(403).send({ message: 'Forbidden Access!!'});
      }
      const result = await paymentsCollection.find(query).sort({_id: -1}).toArray();
      res.send(result);
  });

  app.post('/payments', async ( req, res ) => {
      const payment = req.body;
      const paymentResult = await paymentsCollection.insertOne(payment);

      //carefully delete each item from the cart
      console.log('Payment Info: ', payment);

      res.send({ paymentResult });
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