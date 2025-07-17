import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import adminRoutes from "./routes/adminRoutes/adminRoutes.js";
import vendorRoutes from "./routes/vendorRoutes/vendorRoutes.js";
import webRoutes from "./routes/webRoutes/webRoutes.js"
import tampilan from "./routes/cektampilanRoutes/cekTampilan.js"
import "./controllers/corn/corn.js";

dotenv.config();

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cookieParser()); 
app.use(express.json());
app.set("view engine", "ejs");

// cek tampilan
app.use("/tampilan",tampilan);

//admin 
app.use("/admin", adminRoutes);
// vendor
app.use("/vendor", vendorRoutes);

// web
app.use("/", webRoutes);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
