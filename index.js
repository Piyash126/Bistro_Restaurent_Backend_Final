const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const port = process.env.port || 5000;
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// import { ObjectId } from 'mongodb'; // ES6 module
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);

// Initialize Mailgun client with API key
const mg = mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY, 
});


//middleware

app.use(cors());
app.use(express.json());
//middleware

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ebatubi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
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
        // Send a ping to confirm a successful connection
        const menuCollection = client.db("fs-final-bistro").collection("menu");
        const userCollection = client.db("fs-final-bistro").collection("users");
        const reviewCollection = client.db("fs-final-bistro").collection("reviews");
        const cartCollection = client.db("fs-final-bistro").collection("carts");
        const paymentCollection = client.db("fs-final-bistro").collection("payments");


        //jwt related
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            });
            res.send({ token });
        });


        //middlewares
        // const verifyToken = (req, res, next) => {
        //     console.log('Inside verify token', req.headers.authorization);
        //     if (!req.headers.authorization) {
        //         return res.status(401).send({ message: 'forbidden access' })
        //     }
        //     const token = req.headers.authorization.split(' ')[1];
        //     if (!token) {
        //         return res.status(401).send({ message: 'forbidden access' })
        //     }
        //     jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        //         if (err) {
        //             return res.status(401).send({ message: 'forbidden access' })
        //         }
        //         req.decoded = decoded;
        //         next();
        //     })
        // }

        const verifyToken = (req, res, next) => {
            console.log('Inside verfify Token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access1' })
            }
            const token = req.headers.authorization.split(' ')[1];
            if (!token) {
                return res.status(401).send({ message: 'unauthorized access2' })
            }
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access3' })
                }
                req.decoded = decoded;
                next();

            })
        }
        //use verify admin after verifyToken.
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        //users
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            // console.log(req.headers);
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user.role === 'admin'
            }

            res.send({ admin })
        })

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'unauthorized access!!' })
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user.role === 'admin'
            }
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            //insert email if user  doesnt exists
            // you can do this many ways(1. email enique, 2.upsert, 3.simple checking) 
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'User Allready Exists', insertedId: null });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })



        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })




        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        //menu related
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result);
        })

        app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
            const item = req.body;
            const result = await menuCollection.insertOne(item);
            res.send(result);
        })

        app.get('/menu/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: id };
            const result = await menuCollection.findOne(query);
            res.send(result);
        })

        app.patch('/menu/:id', async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: id };
            const updatedDoc = {
                $set: {
                    name: item.name,
                    category: item.catgeory,
                    price: item.price,
                    recipe: item.recipe,
                    image: item.image
                }
            }

            console.log(updatedDoc);

            const result = await menuCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: id };
            console.log(query);
            const result = await menuCollection.deleteOne(query);
            res.send(result);
        })

        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        })

        //carts collection
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/carts', async (req, res) => {
            const cartItem = req.body;
            const result = await cartCollection.insertOne(cartItem);
            res.send(result);
        })

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })

        //payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log('AMount inside the intent', amount);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment);

            //carefully delete each item from the cart

            console.log('Payment info', payment);
            const query = {
                _id: {
                    $in: payment.cartIds.map((id) => new ObjectId(id))
                }
            }

            //send user email about payment confirmation
            async function sendOrderConfirmationEmail() {
                try {
                    const msg = await mg.messages.create(process.env.MAIL_SENDING_DOMAIN, {
                        from: `Mailgun Sandbox <postmaster@${process.env.MAIL_SENDING_DOMAIN}>`,
                        to: ['shovonprodhan32@gmail.com'],
                        subject: 'Bistro Boss Order Confirmation!',
                        text: 'This is a test email using Mailgun.js and Node.js.',
                        html: `<div>
                                <h2>Thank you for your order</h2>
                                <h4>Transaction ID: <strong>${payment.transactionId}</strong></h4>
                                <p>We would like your feedback about the food!</p>
                                </div>`,
                    });

                    console.log('Email sent:', msg);
                } catch (err) {
                    console.error('Failed to send email:', err);
                }
            }

            sendOrderConfirmationEmail();


            const deleteResult = await cartCollection.deleteMany(query);
            // const query = {
            //     _id: {
            //         $in: payment.cartIds.map(id => new ObjectId(id))
            //     }
            // }
            // const deleteResult = await cartCollection.deleteMany(query);
            res.send({ paymentResult, deleteResult });
            // const { } = { _id: new ObjectId(id) }
        })

        app.get('/payments/:email', async (req, res) => {
            const query = { email: req.params.email };
            // if (req.params.email !== req.decoded.email) {
            //     return res.status(403).send({ message: 'frobidden access!!' });
            // }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })


        //stats ba analytics

        app.get('/admin-stats', verifyToken, async (req, res) => {
            const users = await userCollection.estimatedDocumentCount();
            const menuItems = await menuCollection.estimatedDocumentCount();
            const orders = await paymentCollection.estimatedDocumentCount();

            //this is not the best way
            // const payments = await paymentCollection.find().toArray();
            // const revenue = payments.reduce((total, payment) => total + payment.price, 0)
            const result = await paymentCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: {
                            $sum: '$price'
                        }
                    }
                }
            ]).toArray();

            const revenue = result.length > 0 ? result[0].totalRevenue : 0;

            res.send({
                users,
                menuItems,
                orders,
                revenue
            })
        })

        // order status

        /**
         * non efficint way:
         * 1.load all the payments
         * 2.for every menuItemIds (which is an array), go find the item from menuCollection
         * 3.for every item in the menu collection that you found from the a payment entry(document) 
         */

        // using aggregate pipeline
        app.get('/order-stats', async (req, res) => {
            const result = await paymentCollection.aggregate([
                {
                    $unwind: '$menuItemIds'
                },
                {
                    $lookup: {
                        from: 'menu',
                        localField: 'menuItemIds',
                        foreignField: '_id',
                        as: 'meniItems'
                    }
                },
                {
                    $unwind: '$meniItems'
                },
                {
                    $group: {
                        _id: '$meniItems.category',
                        quantity: {
                            $sum: 1
                        },
                        revenue: {
                            $sum: '$meniItems.price'
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        category: '$_id',
                        quantity: '$quantity',
                        revenue: '$revenue'
                    }
                }
            ]).toArray();
            res.send(result);
        })

    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Server is runnig');
});

app.listen(port, () => {
    console.log(`Bistro Boss is Sitting on port ${port}`)
})