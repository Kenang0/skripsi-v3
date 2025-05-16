import express from "express";

import {liatFrontEnd,tampilkanPeta,cekPemesananSMS,pengaturan_akun} from "../../controllers/cekFrontEnd/cekTampilan.js";


const router = express.Router();

router.get("/cek-aje",liatFrontEnd);
router.get("/coba-peta",tampilkanPeta);
router.post("/data-pemesanan", cekPemesananSMS);
router.get("/pengaturan-akun", pengaturan_akun);
export default router;