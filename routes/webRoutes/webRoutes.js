import express from "express";
import { authenticateRoleWeb } from "../../middleware/authMiddleware.js";
import { authenticateRoleDashAdmin } from "../../middleware/authMiddleware.js";
// sebelum login
import { liatFrontEnd, ambilhome_belomlogin, detailProdukSms } from "../../controllers/webController/web.js";
// sesudah login
import {
    getLoginPageWeb, loginUserWeb, getHomeweb, getpengaturan, loginDetailProdukSms, loginFormPesanProdukSms, handlePesanSMS, getOnProgress,
    getbuktiPemesananBy,batalPemesanan
} from "../../controllers/webController/web.js";

const router = express.Router();

router.get("/cekfrontend", liatFrontEnd);

//sebelum login
router.get("/", ambilhome_belomlogin);
router.get("/produk-sms/:id", detailProdukSms);

//login web
router.get("/login-user", getLoginPageWeb);
router.post("/login-user", loginUserWeb);

// sesudah login
router.get("/home-page", authenticateRoleDashAdmin(["klien", "admin", "partnership", "project lead", "Finance"]), getHomeweb);

router.get("/pengaturan-akun", authenticateRoleDashAdmin(["klien", "admin", "partnership", "project lead", "Finance"]), getpengaturan);

router.get("/view-produk-sms/:id", authenticateRoleDashAdmin(["klien", "admin", "partnership", "project lead", "Finance"]), loginDetailProdukSms);

router.get("/produk-sms/pesan/:id", authenticateRoleDashAdmin(["klien", "admin", "partnership", "project lead", "Finance"]), loginFormPesanProdukSms);

router.post("/produk-sms/pesan/:id", authenticateRoleDashAdmin(["klien", "admin", "partnership", "project lead", "Finance"]), handlePesanSMS);

router.get("/dalam-progress", authenticateRoleDashAdmin(["klien", "admin", "partnership", "project lead", "Finance"]), getOnProgress);

router.get('/bukti-pemesanan/:id_pemesanan',authenticateRoleDashAdmin(["klien", "admin", "partnership", "project lead", "Finance"]), getbuktiPemesananBy);

router.get("/batal-pemesanan/:id",authenticateRoleDashAdmin(["klien", "admin", "partnership", "project lead", "Finance"]), batalPemesanan);


export default router;