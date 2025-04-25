import express from "express";
import { authenticateVendor } from "../../middleware/authMiddleware.js";
import { getLoginPageVendor,loginUserVendor,getDashVendorHome,getTambahProduk,postTambahProduk } from "../../controllers/dashVendorController/authVendor.js";


const router = express.Router();

// login vendor
router.get("/login", getLoginPageVendor);
router.post("/login", loginUserVendor);

// ambil halaman dash vendor home
router.get("/dashboardVendor",authenticateVendor,getDashVendorHome);

// log-out dash vendor
router.get("/logout", (req, res) => {
    res.clearCookie("token"); // Hapus token dari cookie
    res.redirect("/vendor/login"); // Arahkan kembali ke halaman login
  });

// ambil halaman produk
router.get("/dashboardVendor/tambahproduk",authenticateVendor,getTambahProduk);
//submit tambah produk
router.post("/dashboardVendor/tambah-produk",authenticateVendor,postTambahProduk);
export default router;
