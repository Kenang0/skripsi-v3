import express from "express";
import { authenticateVendor } from "../../middleware/authMiddleware.js";
import { getLoginPageVendor,loginUserVendor,getDashVendorHome,getTambahProduk,postTambahProduk,getProdukVendor,deleteProdukRadio,deleteProdukSMS,updateProduk } from "../../controllers/dashVendorController/authVendor.js";


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
// ambil halaman view produk
router.get("/view-produk",authenticateVendor,getProdukVendor);

// delete produk radio
router.delete("/produk/radio/:id", deleteProdukRadio);
// delete produk sms
router.delete("/produk/sms/:id", deleteProdukSMS);
// edit produk
router.put('/produk/update/:id', updateProduk);
export default router;
