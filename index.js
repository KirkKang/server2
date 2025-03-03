const express = require("express");
const app = express();
const mysql = require("mysql");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
require("dotenv").config();
const BASE_URL = process.env.BASE_URL || "http://localhost:3001";


app.use(cors());
app.use(express.json());
app.use("/images",express.static(path.join(__dirname,"images")));

const db = mysql.createConnection({
  user: "root",
  host: "localhost",
  password: "mysql3A917024",
  database: "shopstoredb",
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

// app.post("/create",upload.single('file'),(req, res) => {
//     const sql = "INSERT INTO employee (`name`,`age`,`country`,`position`,`wage`) VALUES(?)";
//     const values = [
//       req.body.name,
//       req.body.age,
//       req.body.country,
//       req.body.position,
//       req.body.wage
//     ]
//     con.query(sql, [values],(err, result)=> {
//       if(err) return res.json({Error: "Error singup query"});
//       return res.json({Status:"Success"});
//     })
// })




app.post("/create",upload.single('image'),(req, res) => {
  const {Product_id, Product_name , Product_price , Product_intro , Product_stock , Product_text } = req.body ;
  const image = req.file ?  req.file.filename : null
  // const name = req.body.name;
  // const age = req.body.age;
  // const country = req.body.country;
  // const position = req.body.position;
  // const wage = req.body.wage;
  

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
        image: emp.Product_image? `${BASE_URL}/images/${emp.Product_image}` : null
      }));
      res.json(Products);
    }
  });
});

// app.put("/update", (req, res) => {
//   const id = req.body.id;
//   const wage = req.body.wage;
//   db.query(
//     "UPDATE employee SET wage = ? WHERE id = ?",
//     [wage, id],
//     (err, result) => {
//       if (err) {
//         console.log(err);
//       } else {
//         res.send(result);
//       }
//     }
//   );
// });

// app.delete("/delete/:id", (req, res) => {
//   const id = req.params.id;
//   db.query("DELETE FROM employee WHERE id = ?", id, (err, result) => {
//     if (err) {
//       console.log(err);
//     } else {
//       res.send(result);
//     }
//   });
// });

app.listen(3001, () => {
  console.log("Yey, your server is running on port 3001");
});
