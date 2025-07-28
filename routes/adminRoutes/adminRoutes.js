import express from "express";

import {  authenticateRoleDashAdmin } from "../../middleware/authMiddleware.js";
import {  loginUser,getLoginPage, getDashHome, 
          getDashAdminPKS,getDashAddPKS,preview_PDF_PKS,
          savedandownload_PKS,getUploadPKSPage,uploadPKS,
          getPengecekanPKSPage,deletePKS, uploadPKSdariView,PKSdiSetujui,getPembuatanAkunVendor,
          pembuatanakunUserInternal,simpanAkunVendor, getPKSSelesai,tolakPKS,cekEmailInternal,vertifikasi, 
          getHalamanTambahAkunInternal,vertifikasiVendor,updatePasswordVendor,updatePasswordInternal,getHalamanPengaturan,
          updateProfil,updatePassword,updateFoto,LaporanAnalitikUSer,HalamanUserInternal,
          forgotPasswordInternal,getHalamanPengecekanPembayaran,deleteTimInternal,UpdateTimInternal,setujuiPembayaran,handlePembayaranKurang,
          getDaftarVendor,updateVendor} from "../../controllers/dashAdminController/authAdmin.js";
import {forgotPasswordVendor} from "../../controllers/dashVendorController/authVendor.js";


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
router.get("/dashboardAdmin", authenticateRoleDashAdmin(["admin", "partnership", "direktur"]), getDashHome);


//ambil halama add pks
router.get ("/dasboardAdmin/addPKS",authenticateRoleDashAdmin(["admin", "partnership", "direktur"]),getDashAddPKS );

// preview pks
router.post ("/dashboardAdmin/preview-pks",authenticateRoleDashAdmin(["admin", "partnership", "direktur"]),preview_PDF_PKS );

// download pks
router.post("/dashboardAdmin/download-pks", authenticateRoleDashAdmin(["admin", "partnership", "direktur"]), savedandownload_PKS);

//ambil halaman upload
router.get('/dashboard/upload-pks/:pks_id', authenticateRoleDashAdmin(["admin", "partnership", "direktur"]),getUploadPKSPage);

// buat tombol upload di halaman upload
router.post("/dashboardAdmin/upload-pks-tandatangan", authenticateRoleDashAdmin(["admin", "partnership", "direktur"]), uploadPKS);

// ambil halaman pengecekan pks di tombol berikutnya yang ada di halaman upload
router.get('/dashboard/pengecekan-pks/:pks_id', authenticateRoleDashAdmin(["admin", "partnership", "direktur"]), getPengecekanPKSPage);

// pembuatan akun vendor
router.post('/dashboardAdmin/pembuatan-akun-vendor', authenticateRoleDashAdmin(["admin", "partnership", "direktur"]), simpanAkunVendor);

// halaman konfirmasi pks selesai
router.get('/dashboardAdmin/pks-selesai/:pks_id', authenticateRoleDashAdmin(["admin", "partnership", "direktur"]), getPKSSelesai);

// penambahan akun
router.get("/dashboardAdmin/penambahan-akun", authenticateRoleDashAdmin(["admin", "direktur"]), getHalamanTambahAkunInternal)
router.post("/dashboarAdmin/tambah-akun", pembuatanakunUserInternal);
router.post("/cek-email",cekEmailInternal);
router.get("/dashboardAdmin/tim-internal",authenticateRoleDashAdmin(["admin", "partnership", "direktur"]), HalamanUserInternal);

// ambil halaman view tabel data PKS dan data akun vendor
router.get ("/dashboardAdmin/PKS", authenticateRoleDashAdmin(["admin", "partnership", "direktur"]), getDashAdminPKS);
router.delete('/dashboardAdmin/delete-pks/:pks_id', authenticateRoleDashAdmin(["admin", "partnership", "direktur"]),deletePKS);
router.get("/dashboardAdmin/upload-pks/:pks_id", authenticateRoleDashAdmin(["admin", "partnership", "direktur"]),  uploadPKSdariView);
router.put('/dashboardAdmin/approve-pks/:pks_id', authenticateRoleDashAdmin(['admin', 'direktur']), PKSdiSetujui);
router.get("/dashboardAdmin/pembuatan-akun-vendor/:pks_id", authenticateRoleDashAdmin(["admin", "partnership", "direktur"]),  getPembuatanAkunVendor);
router.put('/dashboardAdmin/tolak-pks/:pksId', authenticateRoleDashAdmin(["admin", "direktur"]),tolakPKS);
router.get("/dashboardAdmin/daftar-vendor", authenticateRoleDashAdmin(["admin", "direktur"]),  getDaftarVendor);
router.post('/dashboardAdmin/update-vendor', authenticateRoleDashAdmin(["admin", "direktur"]), updateVendor);

// laporan analitik
router.get("/dashboardAdmin/aporan-analitik-user", authenticateRoleDashAdmin(["admin", "partnership", "direktur"]),  LaporanAnalitikUSer);

// pengaturan akun
router.get("/dashboardAdmin/pengaturan-akun", authenticateRoleDashAdmin(["admin", "partnership", "direktur","finance","klien"]), getHalamanPengaturan);
router.post("/internal/update-password",authenticateRoleDashAdmin(["admin", "partnership", "direktur","finance","klien"]),updatePassword);
router.post("/internal/update-profil",authenticateRoleDashAdmin(["admin", "partnership", "direktur","finance", "klien"]),updateProfil);
router.post("/internal/update-foto",authenticateRoleDashAdmin(["admin", "partnership", "direktur","finance", "klien"]),updateFoto);

// CRUD tim internal

router.delete("/internal/delete-user/:id",authenticateRoleDashAdmin(["admin", "direktur"]),deleteTimInternal);
router.post("/internal/update-status/:id",authenticateRoleDashAdmin(["admin", "direktur"]),UpdateTimInternal);
// halaman untuk vertifikasi dan set password untuk vendor dan internal
router.get("/verifikasi", vertifikasi);
router.post("/setpasswordinternal",updatePasswordInternal);
router.get("/verifikasivendor", vertifikasiVendor);
router.post("/setpasswordvendor",updatePasswordVendor);
router.post("/forgot-password",forgotPasswordInternal);
router.get("/reset-password", vertifikasi);
router.post("/dashboardAdmin/forgot-password-vendor", forgotPasswordVendor);


// halaman cek-pembayaran
router.get("/dashboardAdmin/cek-pembayaran",authenticateRoleDashAdmin(["admin", "partnership", "direktur", "Finance"]), getHalamanPengecekanPembayaran);
router.post("/pembayaran/:id_pembayaran/setujui", authenticateRoleDashAdmin(["admin", "Finance"]), setujuiPembayaran);
router.post("/pembayaran/:id_pembayaran/kurang", authenticateRoleDashAdmin(["admin", "Finance"]), handlePembayaranKurang);
export default router;
