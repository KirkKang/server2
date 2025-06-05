const express = require("express");
const app = express();
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
require("dotenv").config();
const PORT = process.env.PORT || 3001 ;
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const salt = 10 ;
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);


// app.use(cors());
app.use(cors({
  origin: 'https://kirkkang.github.io', 
  methods: ["POST","GET","DELETE","PUT"],
  credentials: true
}));
app.use(express.json());
app.use("/images",express.static(path.join(__dirname,"images")));
app.use(cookieParser());

const verifyToken = (req,res,next) => {
  const token = req.cookies.token;
  if(!token){
    return res.status(401).json({Error:"尚未登入"})
  }
  else{
    jwt.verify(token,process.env.JWT_SECRET,(err, decoded)=>{
      if(err){
        return res.status(401).json({Error:"Token 有問題"})
      }
      else{
        req.user = decoded ;
        next();
      }
    })
  }
}

app.get("/",verifyToken, (req, res) => {
  return res.json({Status: "成功",user: req.user});
});

app.get("/time", (req, res) => {
  db.query(
    'SELECT NOW() as now, @@global.time_zone as global_tz, @@session.time_zone as session_tz',
    (err, results) => {
      if (err) {
        console.error('查詢失敗:', err);
        res.status(500).json({ error: '資料庫查詢失敗' });
      } else {
        console.log('當前時間與時區設定:', results);
        
        res.json(results[0]); // ✅ 把結果回傳給前端
      }
    }
  );
});



const fs = require("fs");

const imagesDir = path.join(__dirname, "images");
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
}


// //本機
// const db = mysql.createConnection({
//   user: "root",
//   host: "localhost",
//   password: "mysql3A917024",
//   database: "shopstoredb",
//   decimalNumbers: true,
// });

// db.connect((err) => {
//   if (err) {
//     console.error("MySQL 連線錯誤:", err);
//   } else {
//     console.log("成功連接到 MySQL");
//   }
// });

//本機
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: process.env.DB_TIMEZONE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.query("SET time_zone = '+08:00'", (err) => {
  if (err) {
    console.error("設定時區失敗:", err);
  } else {
    console.log("成功設定 MySQL session 時區為 +08:00");
  }
});
  

// const storage = multer.diskStorage({
//   destination: function(req,file,cb){
//     return cb(null, path.join(__dirname,"images"));
//   },
//   filename: function (req,file,cb) {
//     return cb(null, `${Date.now()}_${file.originalname}`)
//   }
// })

// const upload = multer({storage:storage});




app.get("/api/products", (req, res) => {
  const query = "SELECT * FROM product";
  db.query(query, (err, results) => {
    if (err) {
      console.error("取得產品資料錯誤:", err);
      return res.status(500).json({ error: "伺服器錯誤" });
    }

    // 加上圖片完整路徑
    const productsWithFullImagePath = results.map(product => ({
      id: product.Product_ID,
      name: product.Product_name,
      price: product.price,
      image: `https://product-production-b8fb.up.railway.app/uploads/${product.Image}`,
      quantity: product.quantity,
      Product_introduction: product.Product_introduction,
      Type: product.Type,
      Shelf_status: product.Shelf_status,
      Seller_ID: product.Seller_ID,
      Sell_quantity:product.Sell_quantity,
    }));

    res.json(productsWithFullImagePath);
  });
});




app.post("/api/register", (req, res) => {
  const memberId = uuidv4();
  const {
    name,
    email,
    password,
    phone = "",
    address = ""
  } = req.body;

  const checkSql = "SELECT * FROM member WHERE Email = ?";
  db.query(checkSql, [email], (err, result) => {
    if (err) {
      console.error("查詢 Email 錯誤:", err);
      return res.status(500).json({ Error: "伺服器錯誤" });
    }
    if (result.length > 0) {
      return res.status(400).json({ Error: "Email 已被註冊" });
    }

    bcrypt.hash(password.toString(), salt, (err, hash) => {
      if (err) return res.status(500).json({ Error: "密碼加密失敗" });

      const insertSql = `
        INSERT INTO member 
          (Member_ID, Member_name, Email, password, Phone, Address, role)
        VALUES (?)`;

      const values = [
        memberId,
        name,       // 這裡改成 name，對應前端
        email,
        hash,
        phone,
        address,
        "0"           // role 預設 0
      ];
      db.query(insertSql, [values], (insertErr, result) => {
        if (insertErr) {
          console.error("資料插入錯誤:", insertErr);
          return res.status(500).json({ Error: "資料儲存錯誤" });
        }
        return res.json({ Status: "註冊成功", Member_ID: memberId });
      }); 
    });
  });
});




app.post("/api/login",(req,res)=>{
    const sql = "SELECT * FROM member WHERE Email = ?" ;
    db.query(sql,[req.body.email],(err, data) => {
      if(err) return res.json({Error: "登入失敗"});

      if(data.length > 0 ){
        bcrypt.compare(req.body.password.toString(),data[0].password,(err, response) =>{
          if(err) return res.json({Error:"密碼比較錯誤"})
          if(response){
            const user = data[0]
            const name = user.Member_name;
            const userId = user.Member_ID;
            const email = user.Email;
            const phone = user.Phone || "";
            const address = user.Address || "";

            const token = jwt.sign({id:userId,name},process.env.JWT_SECRET, {expiresIn:'1h'});
            res.cookie('token',token,{
              httpOnly:true,
              maxAge: 60*60*1000,  
              // sameSite: 'strict' // 允許同一個頁面請求才會附加cookie 防止CSRF
              sameSite: 'None',
              secure:true
            });

            const cartSql = "SELECT * FROM cart WHERE user_id = ?";
            db.query(cartSql,[userId],(err,cartData)=>{
              if(err){
                console.log("查詢購物車失敗",err);
                return res.json({Status:"成功",name})
              }

              const products = cartData.map(item => ({
                id: item.product_id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                totalPrice: item.price * item.quantity,
                image: item.image
              }));
              const totalQuantity = products.reduce((sum,item)=> sum + item.quantity,0);
              const totalPrice = products.reduce((sum,item)=> sum + item.totalPrice,0);

              return res.json({
                Status:"成功",
                user:{
                  name,
                  userId,
                  email,
                  phone,
                  address
                },
                cart:{
                  products,
                  totalQuantity,
                  totalPrice
                }
              })
            })
           
          }
          else{
             return res.json({Error:"密碼錯誤"})
          }
        })
      }
      else {
        return res.json({Error:"信箱不存在"})
      }
    })
})

// app.get('/api/check-login', (req, res) => {
//   const token = req.cookies.token;
//   if (!token) {
//     return res.json({ loggedIn: false });
//   }

//   jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
//     if (err) {
//       return res.json({ loggedIn: false });
//     }
//     return res.json({ loggedIn: true, user: decoded });
//   });
// });


app.get("/api/logout",(req,res)=>{
  res.clearCookie('token');
  return res.json({Status:"成功"})
})

app.get('/api/check-auth', (req, res) => {
  const token = req.cookies.token;
   if(!token){
    return res.json({Status:"失敗",Error:"未登入"});
   }

   jwt.verify(token,process.env.JWT_SECRET,(err,decoded)=>{
    if(err){
      return res.json({Status:"失敗",Error:"Token無效"});
    }

    return res.json({Status:"成功",name: decoded.name});
   })
});

app.get("/api/verify", verifyToken, (req, res) => {
  const userId = req.user.id;
  const sql = "SELECT Member_name, Email, Phone, Address FROM member WHERE Member_ID = ?";
  db.query(sql, [userId], (err, data) => {
    if (err) return res.status(500).json({ Error: "伺服器錯誤" });
    if (data.length === 0) return res.status(404).json({ Error: "找不到使用者" });

    const user = data[0];
    return res.json({
      Status: "成功",
      user: {
        id: userId,
        name: user.Member_name,
        email: user.Email,
        phone: user.Phone,
        address: user.Address,
      }
    });
  });
});




app.get('/api/get-cart', verifyToken, (req, res) => {
  const userId = req.user.id;

  const sql = "SELECT product_id AS id, name, price, quantity, image FROM cart WHERE user_id = ?";
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: "取得購物車失敗" });

    // 計算總數量與總價格
    const totalQuantity = results.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = results.reduce((sum, item) => sum + item.price * item.quantity, 0);

    res.json({
      products: results,
      totalQuantity,
      totalPrice,
    });
  });
});


app.post('/api/add-cart', verifyToken, (req, res) => {
  const userId = req.user.id;
  const { product } = req.body; // product: { id, name, price, image, quantity }
  const { id, name, price, image, quantity } = product;

  if ( !id || !quantity || quantity <= 0) {
    return res.status(400).json({ error: "商品資料不完整" });
  }

  // 使用 MySQL UPSERT：若存在就更新數量，否則插入
  const sql = `
    INSERT INTO cart (user_id, product_id, name, price, quantity, image)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE 
      quantity = quantity + VALUES(quantity)
  `;

  db.query(sql, [userId, id, name, price, quantity, image], (err, result) => {
    if (err){
        console.error("新增/更新購物車失敗",err);
     return res.status(500).json({ error: "新增/更新購物車失敗" });
    }

    res.json({ Status: "成功", message: "購物車商品數量已更新" });
  });
});

app.post('/api/sub-cart', verifyToken, (req, res) => {
  const userId = req.user.id;
  const { product } = req.body; // product: { id, quantity }

  if (!product || !product.id || typeof product.quantity !== 'number') {
    return res.status(400).json({ error: "商品資料不完整" });
  }

  const sql = `
    UPDATE cart 
    SET quantity = quantity + ? 
    WHERE user_id = ? AND product_id = ?
  `;

  db.query(sql, [product.quantity, userId, product.id], (err, result) => {
    if (err) return res.status(500).json({ error: "更新購物車失敗" });

    // 如果減完變成 0 或負數，就刪除該商品
    const deleteSql = `
      DELETE FROM cart 
      WHERE user_id = ? AND product_id = ? AND quantity <= 0
    `;

    db.query(deleteSql, [userId, product.id], (err2) => {
      if (err2) return res.status(500).json({ error: "刪除無效商品失敗" });

      res.json({ Status: "成功", message: "購物車商品數量已減少" });
    });
  });
});

app.delete('/api/remove-cart/:productId', verifyToken, (req, res) => {
  const userId = req.user.id;
  const productId = req.params.productId;

  if (!productId) {
    return res.status(400).json({ error: "缺少商品ID" });
  }

  const sql = `DELETE FROM cart WHERE user_id = ? AND product_id = ?`;

  db.query(sql, [userId, productId], (err, result) => {
    if (err) return res.status(500).json({ error: "刪除購物車商品失敗" });

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "找不到該商品" });
    }

    res.json({ Status: "成功", message: "商品已從購物車刪除" });
  });
});

app.post('/api/orders', verifyToken, (req, res) => {
  const userId = req.user.id;
  const {
    order_number,
    billing_name,
    billing_email,
    billing_phone,
    shipping_address,
    shipping_zip,
    payment_method,
    total_price,
    items
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "訂單項目不可為空" });
  }

  const Order_Date = dayjs().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");

  const orderSql = `
    INSERT INTO ordershop 
    (Order_ID, Member_ID, billing_name, billing_email, billing_phone, shipping_address, shipping_zip, Payment_method, total_price,Order_Date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const orderValues = [
    order_number,
    userId,
    billing_name,
    billing_email,
    billing_phone,
    shipping_address,
    shipping_zip,
    payment_method,
    total_price,
    Order_Date
  ];

  db.query(orderSql, orderValues, (err, orderResult) => {
    if (err) {
      console.error("新增訂單失敗:", err);
      return res.status(500).json({ error: "新增訂單失敗" });
    }

    const orderId = orderResult.insertId;

    const itemSql = `
      INSERT INTO order_items (order_id, product_name, product_id, quantity, price, Seller_ID)
      VALUES ?
    `;

    const itemValues = items.map(item => [
      orderId,
      item.product_name,
      item.product_id,
      item.quantity,
      item.price,
      item.Seller_ID
    ]);

    db.query(itemSql, [itemValues], (err2) => {
      if (err2) {
        console.error("新增訂單明細失敗:", err2);
        return res.status(500).json({ error: "新增訂單明細失敗" });
      }

      // 扣除庫存 & 增加銷售數量
      const updatePromises = items.map(item => {
        return new Promise((resolve, reject) => {
          const updateStockSql = `
            UPDATE product
            SET quantity = quantity - ?, 
                Sell_quantity = Sell_quantity + ?
            WHERE Product_ID = ? AND quantity >= ?
          `;
          db.query(updateStockSql, [item.quantity, item.quantity, item.product_id, item.quantity], (err3, result) => {
            if (err3) {
              reject(err3);
            } else if (result.affectedRows === 0) {
              reject(new Error(`產品 ${item.product_name} 庫存不足`));
            } else {
              resolve();
            }
          });
        });
      });

      Promise.all(updatePromises)
        .then(() => {
          // 庫存扣除成功，刪除購物車
          const clearCartSql = `DELETE FROM cart WHERE user_id = ?`;
          db.query(clearCartSql, [userId], (err4) => {
            if (err4) {
              console.log("刪除資料庫購物車失敗", err4);
              return res.status(500).json({ error: "刪除購物車失敗" });
            }

            console.log("新增訂單後刪除資料庫成功，庫存扣除及銷售數量更新成功");
            return res.json({ Status: "成功", orderId });
          });
        })
        .catch(err => {
          console.error("更新庫存/銷售數量失敗:", err);
          return res.status(400).json({ error: err.message || "更新庫存/銷售數量失敗" });
        });
    });
  });
});



app.get('/api/getorders', verifyToken, (req, res) => {
  const userId = req.user.id;
  console.log('解析出來的 user ID:', userId);
  const ordersSql = `
    SELECT Order_ID,id,Order_Date, Order_status, total_price, billing_name, billing_phone, shipping_address
    FROM ordershop
    WHERE Member_ID = ?
    ORDER BY Order_Date DESC
  `;

  db.query(ordersSql, [userId], (err, orders) => {
    if (err) {
      console.error('取得訂單失敗:', err);
      return res.status(500).json({ error: '取得訂單失敗' });
    }

    if (!orders || orders.length === 0) {
      return res.json({ orders: [] });
    }

    const orderIds = orders.map(o => o.id);

    
    const itemsSql = `
      SELECT order_id, product_name, quantity, price
      FROM order_items
      WHERE order_id IN (?)
    `;

    db.query(itemsSql, [orderIds], (err2, items) => {
      if (err2) {
        console.error('取得訂單明細失敗:', err2);
        return res.status(500).json({ error: '取得訂單明細失敗' });
      }

      const itemsMap = {};
      items.forEach(item => {
        if (!itemsMap[item.order_id]) itemsMap[item.order_id] = [];
        itemsMap[item.order_id].push({
          name: item.product_name,
          quantity: item.quantity,
          price: Number(item.price),
        });
      });

      const formattedOrders = orders.map(order => ({
        id: order.Order_ID,
        date: order.Order_Date,
        billing_name: order.billing_name,
        billing_phone: order.billing_phone,
        shipping_address: order.shipping_address,
        total: Number(order.total_price),
        status: order.Order_status,
        products: itemsMap[order.id] || [],
      }));

      console.log('取得訂單:', formattedOrders);

      res.json({ orders: formattedOrders });
    });
  });
});

app.get('/api/userinfo', verifyToken, (req, res) => {
  const userId = req.user.id; // 假設 JWT 裡有 id

  const sql = 'SELECT Member_name, Email, Address, Phone FROM member WHERE Member_ID = ?';
  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: '伺服器錯誤' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: '找不到使用者資料' });
    }
    res.json({
      name: results[0].Member_name || '',
      email: results[0].Email || '',
      address: results[0].Address || '',
      phone: results[0].Phone || '',
    });
  });
});

app.post('/api/updateuserinfo', verifyToken, (req, res) => {
  const userId = req.user.id;
  const { address, phone } = req.body;

  const sql = 'UPDATE member SET Address = ?, Phone = ? WHERE Member_ID = ?';
  db.query(sql, [address, phone, userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: '更新失敗' });
    }
    res.json({ message: '更新成功' });
  });
});






app.listen(PORT, () => {
  console.log(`Yey, your server is running on port ${PORT}`);
});