import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import adminRoutes from "./routes/adminRoutes/adminRoutes.js";
import vendorRoutes from "./routes/vendorRoutes/vendorRoutes.js"

dotenv.config();

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cookieParser()); 
app.use(express.json());
app.set("view engine", "ejs");

//admin 
app.use("/admin", adminRoutes);

app.use("/vendor", vendorRoutes);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
