import express from "express";
import { authenticateRoleWeb } from "../../middleware/authMiddleware.js";
import {  authenticateRoleDashAdmin } from "../../middleware/authMiddleware.js";
// sebelum login
import {liatFrontEnd,ambilhome_belomlogin,detailProdukSms} from "../../controllers/webController/web.js";
// sesudah login
import {getLoginPageWeb,loginUserWeb,getHomeweb,getpengaturan} from "../../controllers/webController/web.js";

const router = express.Router();

router.get("/cekfrontend",liatFrontEnd);

//sebelum login
router.get("/",ambilhome_belomlogin);
router.get("/produk-sms/:id", detailProdukSms);

//login web
router.get("/login-user", getLoginPageWeb);
router.post("/login-user", loginUserWeb);

// sesudah login
router.get("/home-page", authenticateRoleDashAdmin(["klien","admin", "partnership", "project lead","Finance"]),getHomeweb);

router.get("/pengaturan-akun", authenticateRoleDashAdmin(["klien","admin", "partnership", "project lead","Finance"]),getpengaturan);

export default router;