import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../../db.js";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { fileURLToPath } from "url";
import multer from "multer";
import cron from "node-cron";
import { transporter } from "../../nodemailer.js";
import dotenv from "dotenv";
import { Console } from "console";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Setup mutler

//upload pks di tandatangan
const storagePKS = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(__dirname, '../../public/pks_permanen'));
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const tempName = `upload-temp-${timestamp}.pdf`;
    cb(null, tempName);
  }
});

export const uploadPKSFile = multer({ storage: storagePKS });


// untuk foto profile
const storageProfile = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/profile_pic');
  },
  filename: (req, file, cb) => {
    const filename = `profile-${Date.now()}-${file.originalname}`;
    cb(null, filename);
  }
});

export const uploadProfilePic = multer({ storage: storageProfile });

//untuk foto produk
const storageProduk = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/produk_img');
  },
  filename: (req, file, cb) => {
    const filename = `product-${Date.now()}-${file.originalname}`;
    cb(null, filename);
  }
});

export const uploadProductImage = multer({ storage: storageProduk });

//multer setup end

// ngambil login page
export const getLoginPage = (req, res) => {
  res.render("login", { error: null });
};

// mencari email dari tabel user
export const findUserByEmailKlien = async (email) => {
  const query = "SELECT * FROM users WHERE email = $1";
  const result = await pool.query(query, [email]);
  return result.rows[0];
};

// mencari role nya dari tabel user
export const findUserByRole = async (email) => {
  const query = "SELECT role FROM users WHERE email = $1";
  const result = await pool.query(query, [email]);
  return result.rows[0]?.role;
};

// Login admin dan data token 
export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await findUserByEmailKlien(email);
    if (!user) {
      return res.render("login", { error: "Invalid email atau password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render("login", { error: "Invalid email atau password" });
    }

    const role = await findUserByRole(email);
    const token = jwt.sign({ id: user.id, role, full_name: user.full_name }, process.env.JWT_SECRET, { expiresIn: "3h" });
    res.cookie("token", token, { httpOnly: true });

    const rolesAllowed = ["admin", "partnership", "project lead"];
    if (rolesAllowed.includes(role)) {
      res.redirect("dashboardAdmin");
    } else {
      res.render("login", { error: "Unauthorized role" });
    }

  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
};

// ngambil halaman home dash admin
export const getDashHome = async (req, res) => {
  try {
    const Data_tim_internal = await pool.query(`
      SELECT full_name, role, email, nomor_tlp AS nomor_tlp, alamat, photo_user
      FROM users
      WHERE role IN ('admin', 'partnership', 'project_lead', 'finance')
      ORDER BY full_name
    `);

    res.render("dashAdmin/dashboardAdmin", {
      role: req.user.role,
      partial: 'Home',
      data: Data_tim_internal.rows,
      error: ""
    });
  } catch (err) {
    console.error("❌ Error saat ambil data tim internal:", err);
    res.render("dashAdmin/dashboardAdmin", {
      role: req.user.role,
      partial: 'Home',
      data: [],
      error: "Gagal mengambil data tim internal."
    });
  }
};

//mengambil halaman penambahan PKS pembuatan PSK
export const getDashAddPKS = async (req, res) => {
  res.render("dashAdmin/dashboardAdmin", {
    role: req.user.role,
    partial: './form_PKS/addPKS',

    data: [],
    error: ""
  });
};

// previewer PDF PKS di halaman Tambah PKS
export const preview_PDF_PKS = async (req, res) => {
  console.log("=== generatePDF dieksekusi ===");
  console.log("Data yang diterima dari form:", req.body);

  // Ambil data dari form
  const {
    nomor_pks = "",
    hari = "",
    tanggal = "",
    bulan = "",
    tahun = "",
    pt_mitra = "",
    kota = "",
    nik = "",
    pihak_mitra = "",
    jabatan = "",
    alamat_pks = ""
  } = req.body;


let kategori_produk = "";
if (Array.isArray(req.body.kategori)) {
  kategori_produk = '<ul class="three-column-list">' +
    req.body.kategori.map(item => `<li>${item}</li>`).join("") +
    '</ul>';
} else if (typeof req.body.kategori === "string") {
  kategori_produk = `<ul class="three-column-list"><li>${req.body.kategori}</li></ul>`;
}

  try {

    //  Cek apakah nomor_pks sudah ada di database
    const checkPKS = await pool.query("SELECT * FROM pks WHERE nomor_pks = $1", [nomor_pks]);
    if (checkPKS.rows.length > 0) {
      return res.json({ error: "Nomor PKS sudah ada di database." });
    }
    const namaBulan = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const bulanText = namaBulan[parseInt(bulan)] || "";

    // Format tanggal
    const tanggalValue = Array.isArray(tanggal) ? tanggal[0].split : tanggal;
    const bulanValue = Array.isArray(bulan) ? bulan[bulan.length - 1] : bulan;
    const tahunValue = Array.isArray(tahun) ? tahun[tahun.length - 1] : tahun;
    const tanggalFormat = `${tahunValue}-${String(bulanValue)}-${String(tanggalValue)}`;


    // Nama file PDF dan jalur penyimpanan
    const cleanedPtMitra = pt_mitra
      .trim()
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+/g, '_')   // Ganti semua non-alphanumeric yang berderet jadi satu underscore
      .replace(/^_+|_+$/g, '');         // Hapus underscore di awal dan akhir

    const pdfFilename = `${nomor_pks}-${cleanedPtMitra}-${tahunValue}${bulanValue}${tanggalValue}.pdf`;
    const pdfFolder = path.resolve(__dirname, "../../public/pks_sementara");
    const pdfPath = path.resolve(pdfFolder, pdfFilename);

    if (!fs.existsSync(pdfFolder)) {
      fs.mkdirSync(pdfFolder, { recursive: true });
    }

    // mulai perubahan template
    console.log("Meluncurkan Puppeteer...");
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();

    let templateHtml = fs.readFileSync(path.resolve(__dirname, "../../public/templates/template_PKS.html"), "utf8");

    // buat pengecekan kalau nik  tidak di isi diganti dengan ......
    const nikFormatted = nik.trim() === "" ? "............................................" : nik;
    
  
    const formData = {
      ...req.body,
      nik: nikFormatted,
      bulan: bulanText,
      tahun: tahunValue,
      tanggal: tanggalValue,
      kategori_produk
    };

    for (const key in formData) {
      templateHtml = templateHtml.replace(new RegExp(`{${key}}`, "g"), formData[key]);
    }
    await page.setContent(templateHtml, { waitUntil: "networkidle0" });
    await page.pdf({
      path: pdfPath, format: "A4", printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:10px; color:gray; text-align:center; width:100%;"></div>`,
      footerTemplate: `<div style="font-size:12px; color:gray; text-align:right; width:100%; padding-right: 30px"><span class="pageNumber"></span>/<span class="totalPages"></span></div>`,
      margin: {
        top: "30px",
        bottom: "40px"
      }
    });

    await browser.close();

    // Kirim hanya path PDF ke frontend
    res.json({ pdfPath: `/pks_sementara/${pdfFilename}`, pdfFilename, formData: req.body });

  } catch (error) {
    console.error("Error saat membuat PDF:", error);
    res.json({ error: "Terjadi kesalahan dalam pembuatan PDF." });
  }
};

// untuk save dan download PKS yang sudah yakin
export const savedandownload_PKS = async (req, res) => {
  console.log("=== savePKS dieksekusi ===");
  console.log("Data yang akan disimpan ke database:", req.body);

  const {
    nomor_pks, pt_mitra, kota, alamat_pks, nik, pihak_mitra, jabatan, pdfFilename
  } = req.body;

  if (!pdfFilename) {
    return res.json({ error: "Nama file PDF tidak ditemukan. Silakan coba lagi." });
  }

  try {

    const user_id = req.user.id;
    const status = "Menunggu Tanda Tangan";

    // 🔁 Pindahkan file dari pks_sementara ke pks_permanen
    const sumber = path.resolve(__dirname, "../../public/pks_sementara", pdfFilename);
    const tujuan = path.resolve(__dirname, "../../public/pks_permanen", pdfFilename);

    const folderPermanen = path.dirname(tujuan);
    if (!fs.existsSync(folderPermanen)) {
      fs.mkdirSync(folderPermanen, { recursive: true });
    }

    // Pindahkan file
    fs.renameSync(sumber, tujuan);

    // Simpan data ke database
    const result = await pool.query(
      `INSERT INTO pks (nomor_pks, user_id, pt_mitra, kota, alamat_pks, nik, nama_perwakilan, perwakilan_jabatan, nama_dari_pdf, status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING pks_id`,
      [nomor_pks, user_id, pt_mitra, kota, alamat_pks, nik, pihak_mitra, jabatan, pdfFilename, status]
    );

    const pks_id = result.rows[0].pks_id;

    res.json({ success: true, pks_id });

  } catch (error) {
    console.error("Error saat menyimpan ke database:", error);
    res.json({ error: "Terjadi kesalahan saat menyimpan PKS." });
  }
};


// Auto delete file pdf di pks_sementara yang lebih dari 1 jam
cron.schedule("*/30 * * * *", () => { // setiap 30 menit
  const folder = path.resolve(__dirname, "../../public/pks_sementara");

  fs.readdir(folder, (err, files) => {
    if (err) return console.error("Gagal membaca folder:", err);

    files.forEach(file => {
      const filePath = path.join(folder, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;

        const now = Date.now();
        const lastModified = new Date(stats.mtime).getTime();
        const diffInMinutes = (now - lastModified) / (1000 * 60);

        if (diffInMinutes > 60) { // lebih dari 60 menit
          fs.unlink(filePath, (err) => {
            if (!err) {
              console.log(`File ${file} sudah lama, dihapus dari folder pks_sementara.`);
            }
          });
        }
      });
    });
  });
});

// untuk tombol berikutnya dan perpindah halaman ke upload PKS yang sudah di tandatangani
export const getUploadPKSPage = async (req, res) => {
  try {
    const { pks_id } = req.params;
    const user_id = req.user.id;
    console.log("🔁 GET /upload-pks/:pks_id oleh user ID:", user_id, "untuk PKS ID:", pks_id);

    const query = `SELECT * FROM pks WHERE pks_id = $1 AND user_id = $2`;
    const result = await pool.query(query, [pks_id, user_id]);

    const pksTerpilih = result.rows[0];
    if (!pksTerpilih) {
      throw new Error("PKS tidak ditemukan atau bukan milik user ini.");
    }

    res.render("dashAdmin/dashboardAdmin", {
      role: req.user.role,
      partial: "./form_PKS/uploadPKS",
      data: pksTerpilih,
      error: ""
    });
  } catch (error) {
    console.error("Gagal mengambil PKS:", error);
    res.render("dashAdmin/dashboardAdmin", {
      role: req.user.role,
      partial: "./form_PKS/uploadPKS",
      data: {},
      error: "Gagal mengambil data PKS."
    });
  }
};

// tombol upload halaman upload pks 
export const uploadPKS = [
  uploadPKSFile.single('pks_pdf'),
  async (req, res) => {
    try {
      const { pks_id } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).send('Tidak ada file yang diupload.');
      }

      // 🔍 Ambil nama file final dari database
      const result = await pool.query(
        'SELECT nama_dari_pdf FROM pks WHERE pks_id = $1',
        [pks_id]
      );

      const targetName = result.rows[0]?.nama_dari_pdf;
      if (!targetName) {
        return res.status(404).send('Nama file tidak ditemukan di database.');
      }

      const folderTujuan = path.resolve(__dirname, '../../public/pks_permanen');
      const oldPath = file.path; // ini dari multer
      const newPath = path.join(folderTujuan, targetName); // nama dari DB

      // Ganti file lama dengan file baru (overwrite)
      fs.renameSync(oldPath, newPath);

      // ✅ Update status ke 'Menunggu Pengecekan'
      await pool.query(
        'UPDATE pks SET status = $1 WHERE pks_id = $2',
        ['Menunggu Pengecekan', pks_id]
      );

      res.status(200).send("Berhasil mengganti file PKS.");
    } catch (err) {
      console.error('Gagal mengganti file PKS:', err);
      res.status(500).send('Terjadi kesalahan saat mengganti file PKS.');
    }
  }
];

// untuk tombol berikutnya dan perpindah halaman ke upload PKS yang sudah di tandatangani
export const getPengecekanPKSPage = async (req, res) => {
  try {
    const { pks_id } = req.params;
    const user_id = req.user.id;
    console.log("🔁 GET /pengecekan-pks/:pks_id dipanggil");
    console.log("🧾 User ID:", user_id);
    console.log("🧾 PKS ID dari params:", pks_id);

    const query = `SELECT pks.*, users.full_name FROM pks JOIN users ON users.id = pks.user_id WHERE pks.pks_id = $1 AND pks.user_id = $2 `;
    const result = await pool.query(query, [pks_id, user_id]);

    const pksTerpilih = result.rows[0];
    console.log("📦 Data PKS yang ditemukan:", pksTerpilih);
    if (!pksTerpilih) {
      throw new Error("PKS tidak ditemukan atau bukan milik user ini.");
    }

    res.render("dashAdmin/dashboardAdmin", {
      role: req.user.role,
      partial: "./form_PKS/pengecekanPKS",
      data: pksTerpilih,
      error: ""
    });
  } catch (error) {
    console.error("Gagal mengambil PKS:", error);
    res.render("dashAdmin/dashboardAdmin", {
      role: req.user.role,
      partial: "./form_PKS/pengecekanPKS",
      data: {},
      error: "Gagal mengambil data PKS."
    });
  }
};

// kirim email vertifikasi untuk Vendor
export const kirimEmailVerifikasiVendor = async (user) => {
  const token = jwt.sign(
    { id: user.id, email: user.email_vendor },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  const verifikasiURL = `http://localhost:3000/admin/verifikasivendor?token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: user.email_vendor,
    subject: "Verifikasi Akun Anda",
    html: `
      <h3>Halo, ${user.nama_toko_vendor}</h3>
      <p>Silakan klik tombol di bawah ini untuk verifikasi akun vendor anda:</p>
      <a href="${verifikasiURL}" style="padding: 10px 20px; background: #4CAF50; color: white; text-decoration: none;">Verifikasi Email</a>
      <p>Link ini akan kadaluarsa dalam 24 jam.</p>
    `
  };

  await transporter.sendMail(mailOptions);
};

// pembuatan akun vendor
export const simpanAkunVendor = async (req, res) => {
  const { pks_id, nama_toko_vendor, email, password, no_telepon } = req.body;
  console.log("Data dari form:", req.body);

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users_vendor
      (pks_id, nama_toko_vendor, email_vendor, password_vendor, no_telepon_vendor,photo_vendor, vertifikasi_vendor)
      VALUES ($1, $2, $3, $4, $5,$6, 'belom terbertifikasi') RETURNING *`,
      [pks_id, nama_toko_vendor, email, hashedPassword, no_telepon, "img_placeholder.jpg"]
    );

    const vendorBaru = result.rows[0];

    // Kirim email verifikasi
    await kirimEmailVerifikasiVendor({
      id: vendorBaru.id_vendor,
      email_vendor: vendorBaru.email_vendor,
      nama_toko_vendor: vendorBaru.nama_toko_vendor
    });

    await pool.query(
      `UPDATE pks SET status = 'PKS Selesai' WHERE pks_id = $1`,
      [pks_id]
    );

    // Redirect ke halaman sukses
    res.redirect(`/admin/dashboardAdmin/pks-selesai/${pks_id}`);
  } catch (err) {
    console.error("Error simpan akun vendor:", err);
    res.status(500).send("Gagal menyimpan akun vendor.");
  }
};

export const vertifikasiVendor = async (req, res) => {
  const { token } = req.query;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id, email } = decoded;
    console.log(id, email);

    // Update user jadi terverifikasi
    await pool.query("UPDATE users_vendor SET vertifikasi_vendor = 'sudah tervertifikasi' WHERE id_vendor = $1", [id]); // ganti ini nanti
    res.send("✅ Email berhasil diverifikasi!");
  } catch (err) {
    res.status(400).send("❌ Link tidak valid atau sudah kadaluarsa.");
  }
};

export const getPKSSelesai = async (req, res) => {
  const { pks_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT pks_id, pt_mitra FROM pks WHERE pks_id = $1`,
      [pks_id]
    );

    const pks = result.rows[0];
    if (!pks) return res.status(404).send("PKS tidak ditemukan.");


    res.render("dashAdmin/dashboardAdmin", {
      role: req.user.role,
      partial: "./form_PKS/konfirmasiPKSSelesai",
      data: pks,
      error: ""
    });
  } catch (err) {
    console.error("Gagal ambil data PKS:", err);
    res.status(500).send("Terjadi kesalahan.");
  }
};



// Form PKS END

// halaman View PKS data start
// mengambil halaman PKS untuk melihat data PKS vendor
export const getDashAdminPKS = async (req, res) => {
  try {
    // Ambil semua data PKS dan join dengan nama user
    const query = `
      SELECT pks.*, users.full_name
      FROM pks
      JOIN users ON users.id = pks.user_id
      ORDER BY pks.pembuatan_pks DESC
    `;
    const allPKS = await pool.query(query);

    // Kelompokkan berdasarkan status
    const dataPKS = {
      pks_dalam_progress: allPKS.rows.filter(progress =>
        ['Menunggu Tanda Tangan', 'Menunggu Pembuatan Akun Vendor'].includes(progress.status)
      ),
      pks_butuh_cek: allPKS.rows.filter(cek =>
        cek.status === 'Menunggu Pengecekan'
      ),

      pks_selesai: allPKS.rows.filter(selesai =>
        ['PKS Diterima', 'PKS Selesai', 'PKS Ditolak'].includes(selesai.status)
      ),
    };


    console.log("==== Semua PKS ====");
    console.log(allPKS.rows);

    console.log("==== PKS Dalam Progress ====");
    console.log(dataPKS.pks_dalam_progress);

    console.log("==== PKS Butuh Cek ====");
    console.log(dataPKS.pks_butuh_cek);

    console.log("==== PKS Selesai ====");
    console.log(dataPKS.pks_selesai);

    res.render('dashAdmin/dashboardAdmin', {
      partial: 'view_PKS',
      error: null,
      data: dataPKS,
    });

  } catch (err) {
    console.error('Database error:', err.message);
    res.render('dashAdmin/dashboardAdmin', {
      role: req.user.role,
      partial: 'view_PKS',
      error: 'Gagal mengambil halaman PKS',
      data: {},
    });
  }
};

// delete data PKS
export const deletePKS = async (req, res) => {
  const { pks_id } = req.params;
  try {
    await pool.query('DELETE FROM pks WHERE pks_id = $1', [pks_id]);
    res.status(200).json({ message: 'Berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menghapus' });
  }
};

// tombol upload PKS dari view data 
export const uploadPKSdariView = async (req, res) => {
  const { pks_id } = req.params;
  const user_id = req.user.id;
  const role = req.user.role;

  try {
    const query = `SELECT * FROM pks WHERE pks_id = $1`;
    const result = await pool.query(query, [pks_id]);

    if (result.rowCount === 0) {
      return res.status(404).send('PKS tidak ditemukan');
    }

    const pks = result.rows[0];

    // ✅ Cek role dan kepemilikan
    if (role === 'partnership' && pks.user_id !== user_id) {
      return res.status(403).send('Akses ditolak: Anda bukan pemilik PKS ini');
    }

    // Jika admin atau project-lead, langsung lolos
    // atau partnership yang memang pemilik
    res.render("dashAdmin/dashboardAdmin", {
      role: req.user.role,
      partial: "./form_PKS/uploadPKS",
      data: pks,
      error: ""
    });

  } catch (err) {
    console.error('Error saat mengambil PKS:', err);
    res.status(500).send('Terjadi kesalahan saat mengambil data PKS');
  }
};

// tombol Disetujui
export const PKSdiSetujui = async (req, res) => {
  const { pks_id } = req.params;
  const role = req.user.role;
  const full_name = req.user.full_name;

  if (role !== 'admin' && role !== 'project lead') {
    return res.status(403).json({ message: 'Akses ditolak: Anda tidak memiliki izin.' });
  }

  try {
    const keterangan = `Disetujui oleh ${role} - ${full_name}`;

    await pool.query(
      `UPDATE pks 
       SET status = 'Menunggu Pembuatan Akun Vendor', 
           keterangan = $2 
       WHERE pks_id = $1`,
      [pks_id, keterangan]
    );

    res.status(200).json({ message: 'Status & keterangan diperbarui' });
  } catch (err) {
    console.error('Gagal update status PKS:', err);
    res.status(500).json({ message: 'Gagal memperbarui status PKS' });
  }
};

// tombol ditolak
export const tolakPKS = async (req, res) => {
  const { pksId } = req.params;
  const { keterangan } = req.body;

  // Pastikan data user tersedia
  const { role, full_name } = req.user; // kamu wajib pastikan ini ada dari auth middleware
  console.log("🔐 req.user:", req.user); // Tambahkan ini
  if (!keterangan || keterangan.trim() === '') {
    return res.status(400).json({ error: 'Keterangan tidak boleh kosong.' });
  }


  const keteranganLengkap = `Ditolak oleh ${role} - ${full_name}: ${keterangan}`;

  try {
    const result = await pool.query(
      `UPDATE pks
       SET status = $1,
           keterangan = $2
       WHERE pks_id = $3`,
      ['PKS Ditolak', keteranganLengkap, pksId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'PKS tidak ditemukan.' });
    }

    res.status(200).json({ message: 'PKS berhasil ditolak.' });
  } catch (err) {
    console.error('❌ Error saat menolak PKS:', err);
    res.status(500).json({ error: 'Terjadi kesalahan saat memperbarui PKS.' });
  }
};

// tombol  + Akun Vendor
export const getPembuatanAkunVendor = async (req, res) => {
  const { pks_id } = req.params;
  const user_id = req.user.id;
  const role = req.user.role;

  try {
    const query = `SELECT * FROM pks WHERE pks_id = $1`;
    const result = await pool.query(query, [pks_id]);

    if (result.rowCount === 0) {
      return res.status(404).send('PKS tidak ditemukan');
    }

    const pks = result.rows[0];

    // ✅ Cek role dan kepemilikan
    if (role === 'partnership' && pks.user_id !== user_id) {
      return res.status(403).send('Akses ditolak: Anda bukan pemilik PKS ini');
    }

    // Jika admin atau project-lead, langsung lolos
    // atau partnership yang memang pemilik
    res.render("dashAdmin/dashboardAdmin", {
      role: req.user.role,
      partial: "./form_PKS/pembuatanAkunVendor",
      data: pks,
      error: ""
    });

  } catch (err) {
    console.error('Error saat mengambil PKS:', err);
    res.status(500).send('Terjadi kesalahan saat mengambil data PKS');
  }
};
// halaman View PKS data end

//penambahan akun internal start
// get halaman penamban akun internal
export const getHalamanTambahAkunInternal = async (req, res) => {
  res.render("dashAdmin/dashboardAdmin", {
    partial: 'penambahanAkun',
    role: req.user.role,
    data: [],
    error: ""
  });
}


export const cekEmailInternal = async (req, res) => {
  const { email } = req.body;
  try {
    const emailUsers = await findUserByEmailKlien(email);
    return res.json({ terdapatEmail: !!emailUsers }); // true kalau ada, false kalau tidak
  } catch (err) {
    console.error("❌ Error saat cek email:", err);
    return res.status(500).json({ error: "Gagal cek email" });
  }
};

export const createUserInternal = async (email, password, role, full_name, nomor_tlp, alamat) => {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(`
      INSERT INTO users (email, password, role, full_name, nomor_tlp, alamat)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [email, hashedPassword, role, full_name, nomor_tlp, alamat]);

    console.log("✅ Data berhasil disimpan ke database.");

    const user_id_baru = result.rows[0].id;
    console.log("✅ Data berhasil disimpan. ID:", user_id_baru);
    return user_id_baru;
  } catch (err) {
    console.error("❌ Error saat menyimpan data:", err);
    throw err;
  }
};



export const pembuatanakunUserInternal = async (req, res) => {
  const { email, password, role, full_name, nomor_tlp, alamat } = req.body;

  try {
    console.log("🔄 Mulai proses register internal...");
    const existingUser = await findUserByEmailKlien(email);
    if (existingUser) {
      console.log("⚠️ Email sudah terdaftar.");
      // return res.render("testing_register", { error: "Email sudah terdaftar" });
    }

    const user_id = await createUserInternal(email, password, role, full_name, nomor_tlp, alamat);
    console.log("✅ Registrasi internal berhasil!");
    // Kirim email verifikasi
    await kirimEmailVerifikasi({
      id: user_id,
      email,
      full_name
    });
    console.log("✅ email vertifikasi terkirim");
    res.redirect("/admin/dashboardAdmin/penambahan-akun");
  } catch (err) {
    console.error("❌ Error saat register internal:", err);
    res.status(500).render("error", { message: "Terjadi kesalahan pada server." });
  }
};


// kirim email vertifikasi untuk user internal baru
export const kirimEmailVerifikasi = async (user) => {
  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  const verifikasiURL = `http://localhost:3000/admin/verifikasi?token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: "Verifikasi Akun Anda",
    html: `
      <h3>Halo, ${user.full_name}</h3>
      <p>Silakan klik tombol di bawah ini untuk verifikasi akun:</p>
      <a href="${verifikasiURL}" style="padding: 10px 20px; background: #4CAF50; color: white; text-decoration: none;">Verifikasi Email</a>
      <p>Link ini akan kadaluarsa dalam 24 jam.</p>
    `
  };

  await transporter.sendMail(mailOptions);
};

export const vertifikasi = async (req, res) => {
  const { token } = req.query;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id } = decoded;
    console.log(id);

    // Update user jadi terverifikasi
    await pool.query("UPDATE users SET vertifikasi_user = 'sudah tervertifikasi' WHERE id = $1", [id]); // ganti ini nanti

    res.send("✅ Email berhasil diverifikasi!");
  } catch (err) {
    res.status(400).send("❌ Link tidak valid atau sudah kadaluarsa.");
  }
};
// penambahan akun internal end


// testing sesuatu start
// buat melihat front end aja seblum masuk data kalau masih fornt end aja 
export const liatFrontEnd = async (req, res) => {
  res.render("testing_register", {
    // partial: 'view_PKS',
    // data: [], 
    // error: "" 
  });
}

// testing sesuatu end