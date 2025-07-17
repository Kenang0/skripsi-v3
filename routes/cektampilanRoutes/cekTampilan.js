import express from "express";

import {liatFrontEnd,tampilkanPeta,cekPemesananSMS,pengaturan_akun,Produk_radio,Pemenesanan_radio} from "../../controllers/cekFrontEnd/cekTampilan.js";


const router = express.Router();

router.get("/cek-aje",liatFrontEnd);
router.get("/coba-peta",tampilkanPeta);
router.post("/data-pemesanan", cekPemesananSMS);
router.get("/pengaturan-akun", pengaturan_akun);

router.get("/produk-radio",Produk_radio);
router.get("/pesan-radio",Pemenesanan_radio);
export default router;