import express from 'express';
const PORT = 8000;

const app = express();

app.use(express.json());

app.get('/', (req, res)=>{
    res.send("Welcome to local server.");
})

app.listen(PORT, ()=>{
    console.log("Server is running at PORT", PORT);
});