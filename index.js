const express = require("express");
const app = express();
const mysql = require("mysql");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
require("dotenv").config();
const PORT = process.env.PORT || 3001 ;

app.get("/", (req, res) => {
  res.send("Hello from Heroku!");
});

app.listen(PORT, () => {
  console.log(`Yey, your server is running on port ${PORT}`);
});

app.use(cors());
app.use(express.json());
app.use("/images",express.static(path.join(__dirname,"images")));

const db = mysql.createConnection({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port:3306
});

const storage = multer.diskStorage({
  destination: function(req,file,cb){
    return cb(null, path.join(__dirname,"images"));
  },
  filename: function (req,file,cb) {
    return cb(null, `${Date.now()}_${file.originalname}`)
  }
})

const upload = multer({storage:storage});






app.post("/create",upload.single('image'),(req, res) => {
  const {Product_id, Product_name , Product_price , Product_intro , Product_stock , Product_text } = req.body ;
  const image = req.file ?  req.file.filename : null
 
  

  db.query(
    "INSERT INTO product (Product_id, Product_name , Product_price , Product_intro , Product_stock , Product_image , Product_text ) VALUES (?,?,?,?,?,?,?)",
    [Product_id, Product_name, Product_price, Product_intro , Product_stock ,image, Product_text],
    (err, result) => {
      if (err) {
        console.log(err);
        console.log(失敗);
        res.status(500).send("Database error");
      } else {
        res.send("Values Inserted");
      }
    }
  );
});



app.get("/products", (req, res) => {
  db.query("SELECT * FROM product", (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send("Database error");
    } else {
      const Products = result.map(emp => ({
        ...emp,
        image: emp.Product_image? `${PORT}/images/${emp.Product_image}` : null
      }));
      res.json(Products);
    }
  });
});
