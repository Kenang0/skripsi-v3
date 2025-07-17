import express from "express";
import { authenticateRoleWeb,authenticatePembayaranHybrid } from "../../middleware/authMiddleware.js";
import { authenticateRoleDashAdmin } from "../../middleware/authMiddleware.js";
// sebelum login
import { ambilhome_belomlogin, detailProdukSms,registerUser,vertifikasi,forgotPasswordUser,register_akun } from "../../controllers/webController/web.js";
// sesudah login
import {
    getLoginPageWeb, loginUserWeb, getHomeweb, getpengaturan, loginDetailProdukSms, loginFormPesanProdukSms, handlePesanSMS, getOnProgress,
    getbuktiPemesananBy,batalPemesanan,loginDetailProdukRadio,loginFormPesanProdukRadio,handlePesanRadio,
    halamanPembayaran,uploadBuktiPembayaran,verifyPembayaranToken,selesaikanPemesanan,halamanPenyesuaianSMS
} from "../../controllers/webController/web.js";

const router = express.Router();


//sebelum login
router.get("/", ambilhome_belomlogin);
router.get("/produk-sms/:id", detailProdukSms);
router.post('/register', registerUser);
router.get("/register",register_akun);
router.post("/forgot-password",forgotPasswordUser);
router.get("/reset-password", vertifikasi);
//login web
router.get("/login-user", getLoginPageWeb);
router.post("/login-user", loginUserWeb);

// sesudah login
router.get("/home-page", authenticateRoleWeb(["klien", "admin", "partnership", "project lead", "Finance"]), getHomeweb);

router.get("/pengaturan-akun", authenticateRoleWeb(["klien", "admin", "partnership", "project lead", "Finance"]), getpengaturan);

router.get("/view-produk-sms/:id", authenticateRoleWeb(["klien", "admin", "partnership", "project lead", "Finance"]), loginDetailProdukSms);

router.get("/view-produk-radio/:id", authenticateRoleWeb(["klien", "admin", "partnership", "project lead", "Finance"]), loginDetailProdukRadio);

router.get("/produk-sms/pesan/:id", authenticateRoleWeb(["klien", "admin", "partnership", "project lead", "Finance"]), loginFormPesanProdukSms);

router.get("/produk-radio/pesan/:id", authenticateRoleWeb(["klien", "admin", "partnership", "project lead", "Finance"]), loginFormPesanProdukRadio);

router.post("/produk-radio/pesan/:id", authenticateRoleWeb(["klien", "admin", "partnership", "project lead", "Finance"]), handlePesanRadio);

router.post("/produk-sms/pesan/:id", authenticateRoleWeb(["klien", "admin", "partnership", "project lead", "Finance"]), handlePesanSMS);

router.get("/dalam-progress", authenticateRoleWeb(["klien", "admin", "partnership", "project lead", "Finance"]), getOnProgress);

router.get('/bukti-pemesanan/:id_pemesanan',authenticateRoleWeb(["klien", "admin", "partnership", "project lead", "Finance"]), getbuktiPemesananBy);

router.get("/batal-pemesanan/:id",authenticateRoleWeb(["klien", "admin", "partnership", "project lead", "Finance"]), batalPemesanan);

router.get("/pembayaran/:id_pemesanan",authenticateRoleWeb(["klien", "admin", "partnership", "project lead", "Finance"]), halamanPembayaran);

router.post("/upload-bukti",authenticatePembayaranHybrid, uploadBuktiPembayaran);

router.get("/pembayaran/:id_pemesanan/email", verifyPembayaranToken, halamanPembayaran);

router.post('/selesaikan-pemesanan', authenticateRoleWeb(["klien", "admin", "partnership", "project lead", "Finance"]), selesaikanPemesanan);

router.get('/penyesuaian/:id_pemesanan', authenticateRoleWeb(["klien"]),halamanPenyesuaianSMS);

export default router;