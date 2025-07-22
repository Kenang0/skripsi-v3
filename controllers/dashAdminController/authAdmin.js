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
import { Console, error } from "console";

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
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/profile_pic");
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const filename = `user_${Date.now()}${ext}`;
    cb(null, filename);
  },
});

// Hanya izinkan file gambar
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Hanya file gambar (jpg, jpeg, png) yang diperbolehkan"), false);
  }
};

// Export middleware
const upload = multer({ storage, fileFilter }).single("foto_user");

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

    const rolesAllowed = ["admin", "partnership", "direktur"];
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
      WHERE role IN ('admin', 'partnership', 'direktur', 'finance')
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
  return res.status(400).json({
    error: "Nomor PKS sudah ada di database. Silakan gunakan nomor lain."
  });
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
    console.log("✅ Puppeteer path:", puppeteer.executablePath());
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    let templateHtml = fs.readFileSync(path.resolve(__dirname, "../../public/templates/template_pks.html"), "utf8");

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
    console.error("STACK:", error.stack);
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

    // 🔁 Pindah file dari pks_sementara ke pks_permanen
    const sumber = path.resolve(__dirname, "../../public/pks_sementara", pdfFilename);
    const tujuan = path.resolve(__dirname, "../../public/pks_permanen", pdfFilename);

    const folderPermanen = path.dirname(tujuan);
    if (!fs.existsSync(folderPermanen)) {
      fs.mkdirSync(folderPermanen, { recursive: true });
    }

    // Pindah file
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


// Auto delete file pdf di pks_sementara yang lebih dari 30 /1 jam
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

      if (file.mimetype !== 'application/pdf') {
      // Hapus file yang salah upload
      fs.unlinkSync(file.path);
      return res.status(400).send('File harus berformat PDF.');
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

// kirim email vertifikasi dan pembuatan password untuk vendor
export const kirimEmailVerifikasiVendor = async (user) => {
  const token = jwt.sign(
    { id: user.id, email: user.email_vendor },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  const verifikasiURL = `http://localhost:3000/admin/verifikasivendor?token=${token}`; // ubah ke domain saat hosting

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: user.email_vendor,
    subject: "Akun Anda Telah Dibuat",
    html: `
      <p>Yth. Bapak/Ibu<br><strong>${user.nama_pt_mitra}</strong></p>
      <p>Dengan hormat,</p>
      <p>Kami dari <strong>PT Pandawa Sakti Digital</strong> menginformasikan bahwa akun Anda dengan nama toko <strong>${user.nama_toko_vendor}</strong> telah berhasil dibuat.</p>
      <p>Silakan klik tautan berikut untuk mengatur kata sandi Anda dan mengaktifkan akun:</p>
      <p><a href="${verifikasiURL}">${verifikasiURL}</a></p><br>
      <p><small>Link ini berlaku selama 7 hari.</small></p>
      <p>Terima kasih atas kerja sama yang telah terjalin.</p>
      <br>
      <p>Hormat kami,<br><strong>PT Pandawa Sakti Digital</strong></p>
    `
  };

  await transporter.sendMail(mailOptions);
};

// pembuatan akun vendor
export const simpanAkunVendor = async (req, res) => {
  const { pks_id, nama_toko_vendor, email, password, no_telepon } = req.body;
  console.log("Data dari form:", req.body);

  try {
    // 1. Cek email vendor sudah dipakai
    const existing = await pool.query(
      `SELECT * FROM users_vendor WHERE email_vendor = $1`,
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        field: 'email',
        message: 'Email sudah terdaftar sebagai vendor. Silakan gunakan email lain.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result_vendor = await pool.query(
      `INSERT INTO users_vendor
        (pks_id, nama_toko_vendor, email_vendor, password_vendor, no_telepon_vendor, photo_vendor, vertifikasi_vendor)
       VALUES ($1, $2, $3, $4, $5, $6, 'belom terbertifikasi') RETURNING *`,
      [pks_id, nama_toko_vendor, email, hashedPassword, no_telepon, "userPlaceholder.png"]
    );

    const vendorBaru = result_vendor.rows[0];

    const hasilPT = await pool.query(
      `SELECT pt_mitra FROM pks WHERE pks_id = $1`,
      [pks_id]
    );

    const nama_pt_mitra = hasilPT.rows[0]?.pt_mitra || '';

    await kirimEmailVerifikasiVendor({
      id: vendorBaru.id_vendor,
      email_vendor: vendorBaru.email_vendor,
      nama_toko_vendor: vendorBaru.nama_toko_vendor,
      nama_pt_mitra: nama_pt_mitra
    });

    await pool.query(
      `UPDATE pks SET status = 'PKS Selesai' WHERE pks_id = $1`,
      [pks_id]
    );

    res.status(201).json({
      success: true,
      redirect: `/admin/dashboardAdmin/pks-selesai/${pks_id}`
    });
  } catch (err) {
    console.error("Error simpan akun vendor:", err);
    res.status(500).json({
      success: false,
      message: 'Gagal menyimpan akun vendor.'
    });
  }
};


// email mengset password vendor dan melakukan vertifikasi
export const vertifikasiVendor = async (req, res) => {
  const { token } = req.query;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id, email } = decoded;

    // ✅ tandai akun sebagai "sudah terverifikasi"
    await pool.query("UPDATE users_vendor SET vertifikasi_vendor = 'sudah tervertifikasi' WHERE id_vendor = $1", [id]);

    // ✅ render halaman untuk atur password, kirim token ke form
    res.render('Email/setPassword_dan_Konfirmasi_email', {
      token: token // kirim token ke hidden input di form
    });
  } catch (err) {
    console.error("❌ Token tidak valid atau kedaluwarsa:", err.message);
    res.status(400).send("Link verifikasi tidak valid atau sudah kedaluwarsa.");
  }
};

// untuk handle update password dari email
export const updatePasswordVendor = async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.status(400).send("Password dan konfirmasi tidak cocok.");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const hashed = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE users_vendor SET password_vendor = $1 WHERE id_vendor = $2",
      [hashed, decoded.id]
    );

    res.status(200).send("ok");
  } catch (err) {
    console.error("❌ Gagal update password:", err.message);
    res.status(400).send("Token tidak valid atau telah kedaluwarsa.");
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
      role: req.user.role,
    });

  } catch (err) {
    console.error('Database error:', err.message);
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

  if (role !== 'admin' && role !== 'direktur') {
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

  
  const { role, full_name } = req.user; 
  console.log("🔐 req.user:", req.user); 
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

  const verifikasiURL = `http://localhost:3000/admin/verifikasi?token=${token}`; // ganti nanti pas udah di hosting

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: "Verifikasi Akun Anda",
    html: `
      <h3>Halo, ${user.full_name}</h3>
      <p>Kami dari <strong>PT Pandawa Sakti Digital</strong> menginformasikan bahwa akun Anda telah berhasil dibuat.</p>
      <p>Silakan klik tautan berikut untuk mengatur kata sandi Anda dan mengaktifkan akun:</p>
      <p><a href="${verifikasiURL}">${verifikasiURL}</a></p><br>
      <p><small>Link ini berlaku selama 1 hari.</small></p>
      <br>
      <p>Hormat kami,<br><strong>PT Pandawa Sakti Digital</strong></p>
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
    await pool.query("UPDATE users SET vertifikasi_user = 'sudah tervertifikasi' WHERE id = $1", [id]); // ganti ini nanti mungkin

    res.render('Email/konfirmasi_email_internal', {
      token: token // kirim token ke hidden input di form
    });
  } catch (err) {
    res.status(400).send("❌ Link tidak valid atau sudah kadaluarsa.");
  }
};

// untuk handle update password dari email untuk internal
export const updatePasswordInternal = async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.status(400).send("Password dan konfirmasi tidak cocok.");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const hashed = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE users SET password = $1 WHERE id = $2",
      [hashed, decoded.id]
    );

    res.status(200).send("ok");
  } catch (err) {
    console.error("❌ Gagal update password:", err.message);
    res.status(400).send("Token tidak valid atau telah kedaluwarsa.");
  }
};

// penambahan akun internal end


// pengatuaran Akun (settings)
export const getHalamanPengaturan = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    const user = result.rows[0];

    res.render("dashAdmin/dashboardAdmin", {
      partial: 'pengaturan_akun',
      role: req.user.role,
      error: "",
      data: "",
      user
    });
  } catch (err) {
    console.error("❌ Gagal ambil data user:", err);
    res.status(500).send("Terjadi kesalahan.");
  }
};


export const updateProfil = async (req, res) => {
  const userId = req.user.id;
  const { full_name, nomor_tlp, alamat } = req.body;

  try {
    await pool.query(
      `UPDATE users SET full_name = $1, nomor_tlp = $2, alamat = $3 WHERE id = $4`,
      [full_name, nomor_tlp, alamat, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Gagal update profil:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updatePassword = async (req, res) => {
  const userId = req.user.id;
  const { old_password, new_password } = req.body;

  try {
    const user = await pool.query(`SELECT password FROM users WHERE id = $1`, [userId]);
    if (user.rowCount === 0) return res.json({ success: false, message: "User tidak ditemukan" });

    const isMatch = await bcrypt.compare(old_password, user.rows[0].password);
    if (!isMatch) return res.json({ success: false, message: "Password lama salah" });

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query(`UPDATE users SET password = $1 WHERE id = $2`, [hashed, userId]);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Gagal update password:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



export const updateFoto = async (req, res) => {
  upload(req, res, async function (err) {
    if (err) {
      console.error("❌ Multer error:", err);
      return res.status(500).json({ success: false, message: "Upload gagal" });
    }

    const file = req.file;
    const userId = req.user.id;

    if (!file) {
      return res.status(400).json({ success: false, message: "Tidak ada file dikirim" });
    }

    try {
      const { rows } = await pool.query(`SELECT photo_user FROM users WHERE id = $1`, [userId]);
      const fotoLama = rows[0]?.photo_user;
      const fotoBaru = file.filename;
      const folder = path.join("public", "uploads", "profile_pic");

      const isDefault = ["img_placeholder.jpg", "userPlaceholder.png"].includes(fotoLama);

      const pathLama = path.join(folder, fotoLama);
      const pathBaru = path.join(folder, fotoBaru);

      // Kalau nama sama, timpa langsung
      if (fotoLama === fotoBaru) {
        fs.writeFileSync(pathLama, fs.readFileSync(pathBaru));
      } else {
        // Kalau nama beda dan bukan default, hapus lama
        if (fotoLama && !isDefault && fs.existsSync(pathLama)) {
          fs.unlinkSync(pathLama);
        }

        // Simpan ke DB dengan nama baru
        await pool.query(`UPDATE users SET photo_user = $1 WHERE id = $2`, [fotoBaru, userId]);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("❌ Gagal update foto:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });
};

export const forgotPasswordInternal = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email wajib diisi.' });
    }

    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1 AND role != 'klien'`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Email tidak ditemukan untuk akun internal.' });
    }

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    const resetURL = `http://localhost:3000/admin/reset-password?token=${token}`; // ganti saat hosting

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: 'Reset Password Akun Internal',
      html: `
        <h3>Reset Password Akun</h3>
        <p>Halo ${user.nama_lengkap || 'Pengguna'},</p>
        <p>Kami menerima permintaan untuk mereset password Anda.</p>
        <p>Silakan klik link berikut untuk mengatur ulang password Anda:</p>
        <a href="${resetURL}">${resetURL}</a>
        <br><br>
        <p>Link ini berlaku selama 1 hari.</p>
        <p>Jika Anda tidak merasa melakukan permintaan ini, abaikan email ini.</p>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: 'Link reset password telah dikirim ke email.' });

  } catch (error) {
    console.error('❌ Error forgotPasswordInternal:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat memproses permintaan.' });
  }
};

// halaman unutk liat data tim internal
export const HalamanUserInternal = async (req, res) => {
  try {
    const query = `
      SELECT * FROM users 
      WHERE role != 'klien'
    `;

    const result = await pool.query(query);
    console.table(result.rows);
    res.render('dashAdmin/dashboardAdmin', { 
      data: result.rows,
      role: req.user.role,
      partial: 'dataTimInternal',
      error: ""
    });
  } catch (error) {
    console.error("❌ Gagal mengambil data user internal:", error);
    res.status(500).send("Terjadi kesalahan saat mengambil data user internal.");
  }
};



// Laporan analitik
export const LaporanAnalitikUSer = async (req, res) => {
  try {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 5);

 const query = `
  WITH bulan_range AS (
    SELECT generate_series(
      DATE_TRUNC('month', $1::timestamp),
      DATE_TRUNC('month', $2::timestamp),
      interval '1 month'
    ) AS bulan
  ),
  baru AS (
    SELECT DATE_TRUNC('month', dibuat_tanggal) AS bulan, COUNT(*) AS jumlah_baru
    FROM users
    WHERE role = 'klien'
    GROUP BY 1
  ),
  total AS (
    SELECT b.bulan,
          (SELECT COUNT(*) 
           FROM users 
           WHERE role = 'klien' 
             AND dibuat_tanggal <= (b.bulan + interval '1 month - 1 day')) AS jumlah_total
    FROM bulan_range b
  )
  SELECT 
    TO_CHAR(bulan_range.bulan, 'Month YYYY') AS label_bulan,
    COALESCE(baru.jumlah_baru, 0) AS jumlah_baru,
    COALESCE(total.jumlah_total, 0) AS jumlah_total
  FROM bulan_range
  LEFT JOIN baru ON bulan_range.bulan = baru.bulan
  LEFT JOIN total ON bulan_range.bulan = total.bulan
  ORDER BY bulan_range.bulan;
`;

    const { rows } = await pool.query(query, [sixMonthsAgo, today]);

    const labels = rows.map(r => r.label_bulan.trim());
    const dataBaru = rows.map(r => parseInt(r.jumlah_baru));
    const dataTotal = rows.map(r => parseInt(r.jumlah_total));

    res.render("dashAdmin/dashboardAdmin", {
      role: req.user.role,
      partial: "./laporan/grafik_user",
      chartLabels: JSON.stringify(labels),
      chartDataBaru: JSON.stringify(dataBaru),
      chartDataTotal: JSON.stringify(dataTotal)
    });
  } catch (error) {
    console.error("Gagal mengambil halaman analitik user:", error);
    res.render("dashAdmin/dashboardAdmin", {
      role: req.user.role,
      partial: "./laporan/grafik_user",
      chartLabels: "[]",
      chartDataBaru: "[]",
      chartDataTotal: "[]",
      error: "Gagal mengambil Halaman Analitik User."
    });
  }
};


export const getHalamanPengecekanPembayaran = async (req, res) => {
  try {
    const query = `
      SELECT 
        ps.id_pemesanan,
        u.full_name AS pemesan,
        pi.nama_produk,
        pi.harga,
        k.tipe_kategori AS kategori,
        pi.photo_produk,
        uv.nama_toko_vendor AS pemilik_produk,
        ps.jumlah_pemesanan,
        ps.status_pemesanan,

        -- Info pembayaran terakhir
        p.id_pembayaran,
        p.jumlah_bayar,
        p.sisa_tagihan,
        p.waktu_dibayar,
        p.bukti_pembayaran,
        p.status_pembayaran,

        -- Total harga produk = harga satuan * jumlah
        (ps.jumlah_pemesanan * pi.harga) AS total_harga_produk,

        -- Ekspektasi pembayaran awal (harga * jumlah)
        (ps.jumlah_pemesanan * pi.harga) AS total_ekspektasi_pembayaran,

        -- Total dibayar (jumlah_bayar - sisa_tagihan jika status tidak sesuai)
        COALESCE((
          SELECT CASE 
            WHEN sisa_tagihan IS NOT NULL THEN jumlah_bayar - sisa_tagihan
            ELSE jumlah_bayar
          END
          FROM pembayaran
          WHERE id_pemesanan = ps.id_pemesanan
            AND status_pembayaran = 'jumlah pembayaran tidak sesuai'
          ORDER BY waktu_dibayar ASC
          LIMIT 1
        ), 0) AS total_dibayar,

       COALESCE((
  SELECT sisa_tagihan
  FROM pembayaran
  WHERE id_pemesanan = ps.id_pemesanan
    AND status_pembayaran = 'jumlah pembayaran tidak sesuai'
  ORDER BY waktu_dibayar DESC
  LIMIT 1
), 0) AS sisa_tagihan_terhitung

      FROM pembayaran p
      JOIN (
        SELECT id_pemesanan, MAX(waktu_dibayar) AS waktu_terakhir
        FROM pembayaran
        GROUP BY id_pemesanan
      ) AS latest 
        ON p.id_pemesanan = latest.id_pemesanan 
        AND p.waktu_dibayar = latest.waktu_terakhir

      LEFT JOIN pemesanan ps ON p.id_pemesanan = ps.id_pemesanan
      LEFT JOIN produk_iklan pi ON pi.id_produk_iklan = ps.produk_id
      LEFT JOIN kategori k ON k.kategori_id = ps.kategori_id
      LEFT JOIN users u ON u.id = ps.user_id
      LEFT JOIN users_vendor uv ON uv.id_vendor = pi.vendor_id

      WHERE ps.status_pemesanan = 'menunggu verifikasi pembayaran'
      ORDER BY p.waktu_dibayar DESC
    `;

    const result = await pool.query(query);

    console.log("📦 Jumlah data ditemukan:", result.rowCount);
    result.rows.forEach((r, i) => {
      console.log(`📦 #${i + 1} PEMESANAN ${r.id_pemesanan}`);
      console.log(`- Produk: ${r.nama_produk} (${r.kategori})`);
      console.log(`- Harga: Rp ${r.harga}`);
      console.log(`- Jumlah: ${r.jumlah_pemesanan}`);
      console.log(`- Total Harga Produk: Rp ${r.total_harga_produk}`);
      console.log(`- Ekspektasi Bayar: Rp ${r.total_ekspektasi_pembayaran}`);
      console.log(`- Total Dibayar: Rp ${r.total_dibayar}`);
      console.log(`- Sisa Tagihan: Rp ${r.sisa_tagihan_terhitung}`);
      console.log(`- Status: ${r.status_pembayaran}`);
      console.log(`- Bukti: ${r.bukti_pembayaran}`);
      console.log("---------------------------------------------------");
    });

    res.render("dashAdmin/dashboardAdmin", {
      data: result.rows,
      role: req.user.role,
      partial: "cek-pembayaran",
      error: ""
    });
  } catch (error) {
    console.error("❌ Gagal mengambil data pengecekan pembayaran:", error);
    res.status(500).send("Terjadi kesalahan saat memuat data pembayaran.");
  }
};


// Update status user
export const UpdateTimInternal = async (req, res) => {
  const { id } = req.params;
  const { status_users } = req.body;
  await pool.query('UPDATE users SET status_users = $1 WHERE id = $2', [status_users, id]);
  res.redirect('back');
};

// Delete user
export const deleteTimInternal = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
};

export const setujuiPembayaran = async (req, res) => {
  const { id_pembayaran } = req.params;

  try {
    // 1. Ambil id_pemesanan dari pembayaran
    const result = await pool.query(
      `SELECT id_pemesanan FROM pembayaran WHERE id_pembayaran = $1`,
      [id_pembayaran]
    );

    if (result.rowCount === 0) {
      return res.status(404).send("❌ Pembayaran tidak ditemukan.");
    }

    const id_pemesanan = result.rows[0].id_pemesanan;

    // 2. Update status di tabel pembayaran
    await pool.query(
      `UPDATE pembayaran SET status_pembayaran = 'dibayar' WHERE id_pembayaran = $1`,
      [id_pembayaran]
    );

    // 3. Update status di tabel pemesanan
    await pool.query(
      `UPDATE pemesanan SET status_pemesanan = 'Menunggu Bukti Tayang' WHERE id_pemesanan = $1`,
      [id_pemesanan]
    );

    console.log(`✅ Pembayaran #${id_pembayaran} disetujui. Pemesanan #${id_pemesanan} menunggu bukti tayang.`);

    res.redirect("/admin/dashboardAdmin/cek-pembayaran");
  } catch (err) {
    console.error("❌ Gagal menyetujui pembayaran:", err);
    res.status(500).send("Terjadi kesalahan saat menyetujui pembayaran.");
  }
};

export const handlePembayaranKurang = async (req, res) => {
  const { id_pembayaran } = req.params;
  const { sisa_tagihan } = req.body;

  try {
    // 1. Ambil id_pemesanan berdasarkan id_pembayaran
    const { rows } = await pool.query(
      `SELECT id_pemesanan FROM pembayaran WHERE id_pembayaran = $1`,
      [id_pembayaran]
    );
    const id_pemesanan = rows[0]?.id_pemesanan;

    if (!id_pemesanan) return res.status(404).send("ID Pemesanan tidak ditemukan.");

    // 2. TETAPKAN entri pembayaran lama sebagai "jumlah tidak sesuai"
    await pool.query(`
      UPDATE pembayaran
      SET status_pembayaran = 'jumlah pembayaran tidak sesuai', sisa_tagihan = $1
      WHERE id_pembayaran = $2
    `, [sisa_tagihan,id_pembayaran]);



    // 4. Update status pemesanan
    await pool.query(`
      UPDATE pemesanan
      SET status_pemesanan = 'jumlah pembayaran tidak sesuai',
          tanggal_disetujui = CURRENT_TIMESTAMP
      WHERE id_pemesanan = $1
    `, [id_pemesanan]);

    // 5. Kirim email ke pemesan
    await kirimEmailKekurangan(id_pemesanan, sisa_tagihan);

    console.log(`❗ Kekurangan pembayaran Rp${sisa_tagihan} untuk pemesanan ${id_pemesanan}`);
    res.redirect("/admin/dashboardAdmin/cek-pembayaran");
  } catch (err) {
    console.error("❌ Gagal proses kekurangan pembayaran:", err);
    res.status(500).send("Terjadi kesalahan pada sistem.");
  }
};

const kirimEmailKekurangan = async (id_pemesanan, sisa_tagihan) => {
  try {
    // 1. Ambil info user & produk
    const { rows } = await pool.query(`
      SELECT u.email, u.full_name, u.id AS user_id, pi.nama_produk
      FROM pemesanan p
      JOIN users u ON u.id = p.user_id
      JOIN produk_iklan pi ON pi.id_produk_iklan = p.produk_id
      WHERE p.id_pemesanan = $1
    `, [id_pemesanan]);

    if (rows.length === 0) {
      console.warn("⚠️ Tidak ditemukan data untuk email pelunasan.");
      return;
    }

    const { email, full_name, user_id, nama_produk } = rows[0];

    // 2. Buat JWT token
    const token = jwt.sign(
      { user_id, id_pemesanan, role: "klien" },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // 3. Buat link pembayaran
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const paymentLink = `${baseUrl}/pembayaran/${id_pemesanan}/email?token=${token}`;

    // 4. Kirim email
    const mailOptions = {
      from: `"Ngiklan Murah" <${process.env.EMAIL_USER}>`, // black magic
      to: email,
      subject: "Pelunasan Pembayaran Diperlukan",
      html: `
        <p>Halo <strong>${full_name}</strong>,</p>
        <p>Terima kasih atas pesanan Anda untuk produk <strong>${nama_produk}</strong>.</p>
        <p>Namun, kami mendeteksi adanya kekurangan pembayaran sebesar:</p>
        <h3>Rp ${Number(sisa_tagihan).toLocaleString("id-ID")}</h3>
        <p>Silakan segera melakukan pelunasan melalui link berikut (berlaku 24 jam dari email ini di kirim):</p>
        <p><a href="${paymentLink}">${paymentLink}</a></p>
        <br/>
        <p>Terima kasih atas kerjasamanya.</p>
        <p><strong>Tim Ngiklan Murah</strong></p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Email pelunasan terkirim ke ${email}`);
  } catch (err) {
    console.error("❌ Gagal mengirim email pelunasan:", err);
  }
};