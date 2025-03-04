const express = require("express");
const app = express();
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
require("dotenv").config();
const PORT = process.env.PORT || 3001 ;


app.listen(PORT, () => {
  console.log(`Yey, your server is running on port ${PORT}`);
});

app.use(cors());
app.use(express.json());
app.use("/images",express.static(path.join(__dirname,"images")));

app.get("/", (req, res) => {
  res.send("Hello from Heroku!");
});

const fs = require("fs");

const imagesDir = path.join(__dirname, "images");
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
}

const db = mysql.createPool({
  connectionLimit: 10,
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port:process.env.DB_PORT,
  waitForConnections: true,
  queueLimit: 0,
  connectTimeout:10000
});

// db.connect((err) => {
//   if (err) {
//     console.error("無法連接到 MySQL:", err);
//     return;
//   }
//   console.log("成功連接到 MySQL");
// });

db.getConnection((err, connection) => {
  if (err) {
    console.error("無法連接到 MySQL:", err);
  } else {
    console.log("成功連接到 MySQL");
    connection.release();
  }
});

// 每 30 秒 ping 一次，防止連線超時
setInterval(() => {
  db.query('SELECT 1');
}, 30000);

module.exports = db;
console.log(process.env.DB_HOST);


const storage = multer.diskStorage({
  destination: function(req,file,cb){
    return cb(null, path.join(__dirname,"images"));
  },
  filename: function (req,file,cb) {
    return cb(null, `${Date.now()}_${file.originalname}`)
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 限制檔案大小 5MB
});



function handleDisconnect() {
  db.getConnection((err, connection) => {
    if (err) {
      console.error("MySQL 連線錯誤，5 秒後重試...", err);
      setTimeout(handleDisconnect, 5000);
    } else {
      console.log("成功重新連接到 MySQL");
      connection.release();
    }
  });

  db.on('error', function (err) {
    console.error("MySQL 發生錯誤", err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log("重新連接 MySQL...");
      handleDisconnect();
    } else {
      throw err;
    }
  });
}
handleDisconnect();


app.post("/create",upload.single('image'),(req, res) => {
  const {Product_id, Product_name , Product_price , Product_intro , Product_stock , Product_text } = req.body ;
  const image = req.file ?  req.file.filename : null
 
  

  db.query(
    "INSERT INTO product (Product_id, Product_name , Product_price , Product_intro , Product_stock , Product_image , Product_text ) VALUES (?,?,?,?,?,?,?)",
    [Product_id, Product_name, Product_price, Product_intro , Product_stock ,image, Product_text],
    (err, result) => {
      if (err) {
        console.log(err);
        console.log("失敗");
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
        // image: emp.Product_image? `${PORT}/images/${emp.Product_image}` : null
        image: emp.Product_image ? `${req.protocol}://${req.get("host")}/images/${emp.Product_image}` : null
      }));
      res.json(Products);
    }
  });
});
