import express from "express";

import {  authenticateRoleDashAdmin } from "../../middleware/authMiddleware.js";
import {  loginUser,getLoginPage, getDashHome, 
          getDashAdminPKS,getDashAddPKS,preview_PDF_PKS,
          savedandownload_PKS,getUploadPKSPage,uploadPKS,
          getPengecekanPKSPage,deletePKS, uploadPKSdariView,PKSdiSetujui,getPembuatanAkunVendor,
          pembuatanakunUserInternal,simpanAkunVendor, getPKSSelesai,tolakPKS,cekEmailInternal,vertifikasi, 
          getHalamanTambahAkunInternal,vertifikasiVendor,updatePasswordVendor,updatePasswordInternal,getHalamanPengaturan,
          updateProfil,updatePassword,updateFoto,LaporanAnalitikUSer,HalamanUserInternal,forgotPasswordInternal} from "../../controllers/dashAdminController/authAdmin.js";


const router = express.Router();

// login admin
router.get("/login", getLoginPage);
router.post("/login", loginUser);


// log-out dash admin
router.get("/logout", (req, res) => {
    res.clearCookie("token"); // Hapus token dari cookie
    res.redirect("/admin/login"); // Arahkan kembali ke halaman login
  });

// ambil halaaman home
router.get("/dashboardAdmin", authenticateRoleDashAdmin(["admin", "partnership", "project lead"]), getDashHome);


//ambil halama add pks
router.get ("/dasboardAdmin/addPKS",authenticateRoleDashAdmin(["admin", "partnership", "project lead"]),getDashAddPKS );

// preview pks
router.post ("/dashboardAdmin/preview-pks",authenticateRoleDashAdmin(["admin", "partnership", "project lead"]),preview_PDF_PKS );

// download pks
router.post("/dashboardAdmin/download-pks", authenticateRoleDashAdmin(["admin", "partnership", "project lead"]), savedandownload_PKS);

//ambil halaman upload
router.get('/dashboard/upload-pks/:pks_id', authenticateRoleDashAdmin(["admin", "partnership", "project lead"]),getUploadPKSPage);

// buat tombol upload di halaman upload
router.post("/dashboardAdmin/upload-pks-tandatangan", authenticateRoleDashAdmin(["admin", "partnership", "project lead"]), uploadPKS);

// ambil halaman pengecekan pks di tombol berikutnya yang ada di halaman upload
router.get('/dashboard/pengecekan-pks/:pks_id', authenticateRoleDashAdmin(["admin", "partnership", "project lead"]), getPengecekanPKSPage);

// pembuatan akun vendor
router.post('/dashboardAdmin/pembuatan-akun-vendor', authenticateRoleDashAdmin(["admin", "partnership", "project lead"]), simpanAkunVendor);

// halaman konfirmasi pks selesai
router.get('/dashboardAdmin/pks-selesai/:pks_id', authenticateRoleDashAdmin(["admin", "partnership", "project lead"]), getPKSSelesai);

// penambahan akaun
router.get("/dashboardAdmin/penambahan-akun", authenticateRoleDashAdmin(["admin", "project lead"]), getHalamanTambahAkunInternal)
router.post("/dashboarAdmin/tambah-akun", pembuatanakunUserInternal);
router.post("/cek-email",cekEmailInternal);
router.get("/dashboardAdmin/tim-internal",authenticateRoleDashAdmin(["admin", "partnership", "project lead"]), HalamanUserInternal);

// ambil halaman view tabel data PKS
router.get ("/dashboardAdmin/PKS", authenticateRoleDashAdmin(["admin", "partnership", "project lead"]), getDashAdminPKS);
router.delete('/dashboardAdmin/delete-pks/:pks_id', authenticateRoleDashAdmin(["admin", "partnership", "project lead"]),deletePKS);
router.get("/dashboardAdmin/upload-pks/:pks_id", authenticateRoleDashAdmin(["admin", "partnership", "project lead"]),  uploadPKSdariView);
router.put('/dashboardAdmin/approve-pks/:pks_id', authenticateRoleDashAdmin(['admin', 'project lead']), PKSdiSetujui);
router.get("/dashboardAdmin/pembuatan-akun-vendor/:pks_id", authenticateRoleDashAdmin(["admin", "partnership", "project lead"]),  getPembuatanAkunVendor);
router.put('/dashboardAdmin/tolak-pks/:pksId', authenticateRoleDashAdmin(["admin", "project lead"]),tolakPKS);

// laporan analitik
router.get("/dashboardAdmin/aporan-analitik-user", authenticateRoleDashAdmin(["admin", "partnership", "project lead"]),  LaporanAnalitikUSer);

// pengaturan akun
router.get("/dashboardAdmin/pengaturan-akun", authenticateRoleDashAdmin(["admin", "project lead"]), getHalamanPengaturan);
router.post("/internal/update-password",authenticateRoleDashAdmin(["admin", "partnership", "project lead","finance","klien"]),updatePassword);
router.post("/internal/update-profil",authenticateRoleDashAdmin(["admin", "partnership", "project lead","finance", "klien"]),updateProfil);
router.post("/internal/update-foto",authenticateRoleDashAdmin(["admin", "partnership", "project lead","finance", "klien"]),updateFoto);




// halaman untuk vertifikasi dan set password untuk vendor dan internal
router.get("/verifikasi", vertifikasi);
router.post("/setpasswordinternal",updatePasswordInternal);
router.get("/verifikasivendor", vertifikasiVendor);
router.post("/setpasswordvendor",updatePasswordVendor);
router.post("/forgot-password",forgotPasswordInternal);
router.get("/reset-password", vertifikasi);

export default router;
