import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../../db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { findUserByEmailKlien, findUserByRole } from "../dashAdminController/authAdmin.js";
import { transporter } from "../../nodemailer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// register

export const register_akun = (req, res) => {
  res.render("register_user", {
  });
};


export const registerUser = async (req, res) => {
  try {
    const { email, password, namaLengkap, telepon } = req.body;

    if (!email || !password || !namaLengkap || !telepon) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
    }

    const existingUser = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email sudah terdaftar.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(`
      INSERT INTO users (email, password, full_name, nomor_tlp, role, photo_user, status_users, vertifikasi_user)
      VALUES ($1, $2, $3, $4, 'klien','userPlaceholder.png','aktif', 'belum tervertifikasi')
    `, [email, hashedPassword, namaLengkap, telepon]);

    res.status(201).json({ success: true, redirect: '/home-page' });

  } catch (error) {
    console.error('❌ Error saat registrasi:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};
// testing sesuatu end

// seblum login strat
export const ambilhome_belomlogin = async (req, res) => {
  try {
    const radio = await pool.query(`
  SELECT p.*, v.nama_toko_vendor, v.photo_vendor, j.hari, j.jam_mulai, j.jam_selesai, pk.kota
  FROM produk_iklan p
  JOIN users_vendor v ON p.vendor_id = v.id_vendor
  LEFT JOIN jadwal_produk_radio j ON p.id_produk_iklan = j.produk_id
  LEFT JOIN pks pk ON v.pks_id = pk.pks_id
  WHERE p.kategori_id = 1 AND p.status_produk = 'aktif'
`);

    const sms = await pool.query(`
  SELECT p.*, v.nama_toko_vendor, v.photo_vendor, s.provider_yang_di_layani, s.jenis_target, pk.kota
  FROM produk_iklan p
  JOIN users_vendor v ON p.vendor_id = v.id_vendor
  LEFT JOIN detail_produk_sms s ON p.id_produk_iklan = s.produk_id
  LEFT JOIN pks pk ON v.pks_id = pk.pks_id
  WHERE p.kategori_id = 2 AND p.status_produk = 'aktif'
`);
    res.render("web/belom_login/home_page", {
      dataRadio: radio.rows,
      dataSms: sms.rows
    });
  } catch (err) {
    console.error("❌ Gagal ambil data:", err);
    res.status(500).send("Terjadi kesalahan.");
  }
};

export const detailProdukPageSmsBlast = async (req, res) => {
  const { id } = req.params;
  try {
    const produk = await pool.query(`
      SELECT p.*, v.nama_toko_vendor, v.photo_vendor, pk.kota,
             s.provider_yang_di_layani, s.jenis_target
      FROM produk_iklan p
      JOIN users_vendor v ON p.vendor_id = v.id_vendor
      LEFT JOIN detail_produk_sms s ON p.id_produk_iklan = s.produk_id
      LEFT JOIN pks pk ON v.pks_id = pk.pks_id
      WHERE p.id_produk_iklan = $1
    `, [id]);

    const produkTerkait = await pool.query(`
      SELECT * FROM produk_iklan
      WHERE vendor_id = $1 AND id_produk_iklan != $2
      ORDER BY RANDOM() LIMIT 8
    `, [produk.rows[0].vendor_id, id]);

    res.render("web/belom_login/produk_page", {
      produk: produk.rows[0],
      produkTerkait: produkTerkait.rows
    });
  } catch (err) {
    console.error("❌ Gagal ambil detail:", err);
    res.status(500).send("Terjadi kesalahan.");
  }
};

export const detailProdukSms = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT p.*, v.nama_toko_vendor, v.photo_vendor, s.provider_yang_di_layani, s.jenis_target, pk.kota
      FROM produk_iklan p
      JOIN users_vendor v ON p.vendor_id = v.id_vendor
      LEFT JOIN detail_produk_sms s ON p.id_produk_iklan = s.produk_id
      LEFT JOIN pks pk ON v.pks_id = pk.pks_id
      WHERE p.id_produk_iklan = $1
    `, [id]);

    if (result.rows.length === 0) return res.status(404).send("Produk tidak ditemukan.");

    const produk = result.rows[0];

    const produkTerkait = await pool.query(`
      SELECT 
        p.*,
        v.nama_toko_vendor, 
        v.photo_vendor,
        pk.kota,
        s.provider_yang_di_layani,
        s.jenis_target,
        j.hari,
        j.jam_mulai,
        j.jam_selesai
      FROM produk_iklan p
      JOIN users_vendor v ON p.vendor_id = v.id_vendor
      LEFT JOIN detail_produk_sms s ON p.id_produk_iklan = s.produk_id
      LEFT JOIN jadwal_produk_radio j ON p.id_produk_iklan = j.produk_id
      LEFT JOIN pks pk ON v.pks_id = pk.pks_id
      WHERE p.vendor_id = $1 AND p.id_produk_iklan != $2 AND p.status_produk = 'aktif'
      ORDER BY RANDOM()
      LIMIT 8
    `, [produk.vendor_id, id]);

    res.render("web/belom_login/view_detail_produk_sms", {
      produk,
      produkTerkait: produkTerkait.rows
    });
  } catch (err) {
    console.error("❌ Gagal ambil detail produk SMS:", err);
    res.status(500).send("Terjadi kesalahan saat mengambil data.");
  }
};

export const forgotPasswordUser = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email wajib diisi.' });
    }

    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1 AND role = 'klien'`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Email tidak ditemukan' });
    }

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // const resetURL = `http://localhost:3000/reset-password?token=${token}`;
    const resetURL = `skripsi-v3-coba.up.railway.app/reset-password?token=${token}`;

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

export const vertifikasi = async (req, res) => {
  const { token } = req.query;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id } = decoded;
    console.log(id);

    // Update user jadi terverifikasi
    await pool.query("UPDATE users SET vertifikasi_user = 'sudah tervertifikasi' WHERE id = $1", [id]); // ganti ini nanti mungkin

    res.render('Email/setPassword_dan_konfirmasi_email_klien', {
      token: token // kirim token ke hidden input di form
    });
  } catch (err) {
    res.status(400).send("❌ Link tidak valid atau sudah kadaluarsa.");
  }
};



// sebelum login end


// login dari awal 
// ngambil login page web
export const getLoginPageWeb = (req, res) => {
  res.render("login_user", { error: null });
};

// Login home page dan data token 
export const loginUserWeb = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await findUserByEmailKlien(email);
    if (!user) {
      return res.render("login_user", { error: "Invalid email atau password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render("login_user", { error: "Invalid email atau password" });
    }

    const role = await findUserByRole(email);
    const token = jwt.sign({ id: user.id, role, full_name: user.full_name, photo_user: user.photo_user }, process.env.JWT_SECRET, { expiresIn: "3h" });
    res.cookie("token", token, { httpOnly: true });

    const rolesAllowed = ["klien", "admin", "partnership", "project lead", "Finance"]; // bagian boleh akses, di ganti nanti kalau ada perubahan yang boleh akses
    if (rolesAllowed.includes(role)) {
      res.redirect("/home-page");
    } else {
      res.render("login_user", { error: "Unauthorized role" });
    }

  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
};

// ngambil halaman home
export const getHomeweb = async (req, res) => {
  const userId = req.user.id;
  try {
    const user = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);

    const radio = await pool.query(`
  SELECT p.*, v.nama_toko_vendor, v.photo_vendor, j.hari, j.jam_mulai, j.jam_selesai, pk.kota
  FROM produk_iklan p
  JOIN users_vendor v ON p.vendor_id = v.id_vendor
  LEFT JOIN jadwal_produk_radio j ON p.id_produk_iklan = j.produk_id
  LEFT JOIN pks pk ON v.pks_id = pk.pks_id
  WHERE p.kategori_id = 1 AND p.status_produk = 'aktif'
`);

    const sms = await pool.query(`
  SELECT p.*, v.nama_toko_vendor, v.photo_vendor, s.provider_yang_di_layani, s.jenis_target, pk.kota
  FROM produk_iklan p
  JOIN users_vendor v ON p.vendor_id = v.id_vendor
  LEFT JOIN detail_produk_sms s ON p.id_produk_iklan = s.produk_id
  LEFT JOIN pks pk ON v.pks_id = pk.pks_id
  WHERE p.kategori_id = 2 AND p.status_produk = 'aktif'
`);
    res.render("web/sudah_login/home_page_login", {
      dataRadio: radio.rows,
      dataSms: sms.rows,
      dataUser: user.rows[0]
    });
  } catch (err) {
    console.error("❌ Gagal ambil data:", err);
    res.status(500).send("Terjadi kesalahan.");
  }
};


// pengatuaran Akun
export const getpengaturan = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    const user = result.rows[0];

    res.render("web/sudah_login/pengaturan_akun", {
      user
    });
  } catch (err) {
    console.error("❌ Gagal ambil data user:", err);
    res.status(500).send("Terjadi kesalahan.");
  }
};

// halaman produk sms
export const loginDetailProdukSms = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    const user = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    const result = await pool.query(`
      SELECT p.*, v.nama_toko_vendor, v.photo_vendor, s.provider_yang_di_layani, s.jenis_target, pk.kota
      FROM produk_iklan p
      JOIN users_vendor v ON p.vendor_id = v.id_vendor
      LEFT JOIN detail_produk_sms s ON p.id_produk_iklan = s.produk_id
      LEFT JOIN pks pk ON v.pks_id = pk.pks_id
      WHERE p.id_produk_iklan = $1
    `, [id]);

    if (result.rows.length === 0) return res.status(404).send("Produk tidak ditemukan.");

    const produk = result.rows[0];

    const produkTerkait = await pool.query(`
      SELECT 
        p.*,
        v.nama_toko_vendor, 
        v.photo_vendor,
        pk.kota,
        s.provider_yang_di_layani,
        s.jenis_target,
        j.hari,
        j.jam_mulai,
        j.jam_selesai
      FROM produk_iklan p
      JOIN users_vendor v ON p.vendor_id = v.id_vendor
      LEFT JOIN detail_produk_sms s ON p.id_produk_iklan = s.produk_id
      LEFT JOIN jadwal_produk_radio j ON p.id_produk_iklan = j.produk_id
      LEFT JOIN pks pk ON v.pks_id = pk.pks_id
      WHERE p.vendor_id = $1 AND p.id_produk_iklan != $2 AND p.status_produk = 'aktif'
      ORDER BY RANDOM()
      LIMIT 8
    `, [produk.vendor_id, id]);

    res.render("web/sudah_login/view_detail_produk_sms", {
      produk,
      produkTerkait: produkTerkait.rows,
      dataUser: user.rows[0]
    });
  } catch (err) {
    console.error("❌ Gagal ambil detail produk SMS:", err);
    res.status(500).send("Terjadi kesalahan saat mengambil data.");
  }
};

// halaman produk radio
export const loginDetailProdukRadio = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    console.log("🔍 userId:", userId);
    console.log("🔍 produkId (radio):", id);

    // Ambil data user
    const user = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    console.log("✅ Data user:", user.rows[0]);

    // Ambil detail produk radio
    const result = await pool.query(`
      SELECT p.*, v.nama_toko_vendor, v.photo_vendor, pk.kota
      FROM produk_iklan p
      JOIN users_vendor v ON p.vendor_id = v.id_vendor
      LEFT JOIN pks pk ON v.pks_id = pk.pks_id
      WHERE p.id_produk_iklan = $1 AND p.kategori_id = 1
    `, [id]);

    if (result.rows.length === 0) {
      console.log("❌ Produk tidak ditemukan!");
      return res.status(404).send("Produk tidak ditemukan.");
    }

    const produk = result.rows[0];
    console.log("✅ Data produk:", produk);

    // ===============================
    // SEMENTARA: Ambil slot dari vendor (belum dari pemesanan yang sudah dibayar)
    // ===============================
    const jadwalResult = await pool.query(`
      SELECT hari, jam_mulai, jam_selesai,slot_penayangan
      FROM jadwal_produk_radio
      WHERE produk_id = $1
    `, [id]);

    console.log("📅 Jadwal dari DB (jadwal_produk_radio):", jadwalResult.rows);

    // Ambil hari yang tersedia dari semua jadwal
    const hariTersedia = jadwalResult.rows
      .map(j => j.hari.split(','))
      .flat()
      .map(h => h.trim().toLowerCase());

    // Daftar semua hari
    const semuaHari = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
    // Cari hari yang tidak termasuk jadwal
    const hariTidakAktif = semuaHari.filter(h => !hariTersedia.includes(h));

    // Peta hari ke angka versi FullCalendar (0 = Minggu)
    const mapHari = {
      'minggu': 0, 'senin': 1, 'selasa': 2, 'rabu': 3, 'kamis': 4, 'jumat': 5, 'sabtu': 6
    };

    const hariDisable = hariTidakAktif.map(h => mapHari[h]);


    const mappingHari = {
      'Senin': 1,
      'Selasa': 2,
      'Rabu': 3,
      'Kamis': 4,
      'Jumat': 5,
      'Sabtu': 6,
      'Minggu': 0
    };

    const today = new Date();
    const jadwalEvents = [];

    for (const row of jadwalResult.rows) {
      const hariList = row.hari.split(',');
      for (const hari of hariList) {
        const dayIndex = mappingHari[hari.trim()];
        if (dayIndex === undefined) continue;

        const targetDate = new Date(today);
        const currentDay = today.getDay();
        let daysUntilTarget = (dayIndex - currentDay + 7) % 7;
        if (daysUntilTarget === 0) daysUntilTarget = 7;
        targetDate.setDate(today.getDate() + daysUntilTarget);

        const startDate = new Date(targetDate);
        const endDate = new Date(targetDate);

        const [jamMulai, menitMulai] = row.jam_mulai.split(':').map(Number);
        const [jamSelesai, menitSelesai] = row.jam_selesai.split(':').map(Number);

        startDate.setHours(jamMulai, menitMulai, 0, 0);
        endDate.setHours(jamSelesai, menitSelesai, 0, 0);

        // if (endDate <= startDate) {
        //   const endOfDay = new Date(startDate);
        //   endOfDay.setHours(23, 59, 59, 999);
        //   jadwalEvents.push({
        //     title: 'Slot Ditawarkan Vendor',
        //     start: startDate.toISOString(),
        //     end: endOfDay.toISOString()
        //   });

        //   const nextStart = new Date(startDate);
        //   nextStart.setDate(nextStart.getDate() + 1);
        //   nextStart.setHours(0, 0, 0, 0);

        //   const finalEnd = new Date(startDate);
        //   finalEnd.setDate(finalEnd.getDate() + 1);
        //   finalEnd.setHours(jamSelesai, menitSelesai, 0, 0);

        //   jadwalEvents.push({
        //     title: 'Slot Ditawarkan Vendor',
        //     start: nextStart.toISOString(),
        //     end: finalEnd.toISOString()
        //   });
        // } else {
        //   jadwalEvents.push({
        //     title: 'Slot Ditawarkan Vendor',
        //     start: startDate.toISOString(),
        //     end: endDate.toISOString()
        //   });
        // }
      }
    }

    console.log("📦 Jadwal Events Final (untuk preview):", jadwalEvents);
    console.log("🎯 Semua hari dari DB:", hariTersedia);
    console.log("⛔ hariDisable dari server:", hariDisable);
    // Produk terkait
    const produkTerkait = await pool.query(`
      SELECT 
        p.*, v.nama_toko_vendor, v.photo_vendor, pk.kota
      FROM produk_iklan p
      JOIN users_vendor v ON p.vendor_id = v.id_vendor
      LEFT JOIN pks pk ON v.pks_id = pk.pks_id
      WHERE p.vendor_id = $1 AND p.id_produk_iklan != $2 AND p.status_produk = 'aktif'
      ORDER BY RANDOM()
      LIMIT 8
    `, [produk.vendor_id, id]);

    if (jadwalResult.rows.length === 0) {
      console.log("❌ Jadwal tidak ditemukan untuk produk ini.");
      return res.status(404).send("Jadwal penayangan belum diatur oleh vendor.");
    }



    res.render("web/sudah_login/view_detail_produk_radio", {
      produk,
      jadwalResult: jadwalResult.rows[0],
      produkTerkait: produkTerkait.rows,
      dataUser: user.rows[0],
      jadwalEvents: JSON.stringify(jadwalEvents),
      hariDisable
    });
  } catch (err) {
    console.error("❌ Gagal ambil detail produk RADIO:", err);
    res.status(500).send("Terjadi kesalahan saat mengambil data.");
  }
};

export const loginFormPesanProdukRadio = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const user = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);

    const result = await pool.query(`
        SELECT p.* , v.nama_toko_vendor, v.photo_vendor, pk.kota, j.hari, j.jam_mulai, j.jam_selesai, j.slot_penayangan
        FROM produk_iklan p
        JOIN users_vendor v ON p.vendor_id = v.id_vendor
        LEFT JOIN jadwal_produk_radio j ON p.id_produk_iklan = j.produk_id
        LEFT JOIN pks pk ON v.pks_id = pk.pks_id
        WHERE p.id_produk_iklan = $1`, [id]);

    if (result.rows.length === 0) return res.status(404).send("Produk tidak ditemukan");

    const produk = result.rows[0];

    const existingSlots = await pool.query(`
      SELECT 
        d.tanggal_tayang_pemesanan_radio AS tanggal,
        d.jam_tayang_pemesanan_radio
      FROM detail_pemesanan_radio d
      JOIN pemesanan p ON d.id_pemesanan = p.id_pemesanan
      WHERE p.produk_id = $1
        AND p.status_pemesanan IN (
          'menunggu konfirmasi',
          'menunggu pengecekan pembayaran',
          'menunggu bukti tayang',
          'selesai'
        )
    `, [id]);

    const jadwalEvents = existingSlots.rows.length > 0
      ? JSON.stringify(existingSlots.rows.map(row => ({
        title: 'Terisi',
        start: `${row.tanggal}T${row.jam_tayang_pemesanan_radio}`,
        end: `${row.tanggal}T${row.jam_tayang_pemesanan_radio}`
      })))
      : '[]'; // fallback agar tidak error di EJS saat data kosong

    console.log("📅 Slot yang ditemukan di DB:", existingSlots.rows);
    console.log("📦 jadwalEvents (JSON):", jadwalEvents);

    console.table(result.rows);
    console.log(user.rows[0]);
    res.render("web/sudah_login/produk_radio_pesan", {
      produk,
      dataUser: user.rows[0],
      jadwalEvents
    });
  } catch (err) {
    console.error("❌ Gagal ambil halaman/ data untuk radio:", err);
    res.status(500).send("Terjadi kesalahan.");
  }
};


export const loginFormPesanProdukSms = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const user = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);

    const result = await pool.query(`
      SELECT p.*, v.nama_toko_vendor, v.photo_vendor, s.provider_yang_di_layani, s.jenis_target, pk.kota
      FROM produk_iklan p
      JOIN users_vendor v ON p.vendor_id = v.id_vendor
      LEFT JOIN detail_produk_sms s ON p.id_produk_iklan = s.produk_id
      LEFT JOIN pks pk ON v.pks_id = pk.pks_id
      WHERE p.id_produk_iklan = $1
    `, [id]);

    if (result.rows.length === 0) return res.status(404).send("Produk tidak ditemukan");

    const produk = result.rows[0];

    res.render("web/sudah_login/produk_sms_blast_pesan", {
      produk,
      dataUser: user.rows[0],
      googleMapsApiKey: process.env.Maps_API
    });
  } catch (err) {
    console.error("❌ Gagal ambil data produk untuk pemesanan:", err);
    res.status(500).send("Terjadi kesalahan.");
  }
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folder = "./public/uploads/sms_files/";
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();

    let prefix = "FILE_SMS";
    if (file.fieldname === "file_foto_mms") {
      prefix = "FOTO_MMS";
    } else if (file.fieldname === "file_nomor_sms_pdf") {
      prefix = "DAFTAR_NOMOR";
    }

    const finalName = `${prefix}_${timestamp}_${random}${ext}`;
    cb(null, finalName);
  }
});

export const uploadSMSFiles = multer({
  storage,
  // limits: { fileSize: 5 * 1024 * 1024 }, // limit 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "text/csv", "application/vnd.ms-excel"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Format file tidak didukung"));
    }
  }
});


const uploadFields = uploadSMSFiles.fields([
  { name: "file_foto_mms", maxCount: 1 },
  { name: "file_nomor_sms_csv", maxCount: 1 }
]);

export const handlePesanSMS = (req, res) => {
  uploadFields(req, res, async (err) => {
    if (err) {
      console.error("❌ Error saat upload file:", err);
      return res.status(400).send("Gagal upload file: " + err.message);
    }

    try {
      const userId = req.user.id;
      const { id } = req.params;

      const {
        masking_sender,
        target_umur,
        teks_iklan_sms,
        alamat_target_sms,
        jam_kirim,
        latitude,
        longitude,
        nomor_penerima_bukti_tayang,
        sumber_nomor: sumber_nomor_from_user,
        catatan,
        jumlah
      } = req.body;

      const tanggal_pengiriman_start = req.body.tanggal_kirim_start || req.body.tanggal_kirim;
      const tanggal_pengiriman_end = req.body.tanggal_kirim_end || req.body.tanggal_kirim;


      const file_foto_mms = req.files["file_foto_mms"]?.[0]?.filename || null;
      const file_nomor_sms_csv = req.files["file_nomor_sms_csv"]?.[0]?.filename || null;

      console.log("🛩️ Incoming request from user:", userId);
      console.log("📦 Produk ID:", id);
      console.log("📞 nomor penerima:", nomor_penerima_bukti_tayang);
      console.log("📩 Teks iklan:", teks_iklan_sms);
      console.log("🗂️ File foto MMS:", file_foto_mms);
      console.log("📄 File nomor PDF:", file_nomor_sms_csv);
      console.log("📍 Alamat:", alamat_target_sms);
      console.log("🌐 Latitude/Longitude:", latitude, longitude);
      console.log("📌 Sumber nomor (user input):", sumber_nomor_from_user);
      console.log("📒 Catatan:", catatan);
      console.log("📒 jumlah pesanan:", jumlah);


      const produkResult = await pool.query(
        `SELECT p.kategori_id,s.jenis_target
         FROM produk_iklan p
         LEFT JOIN detail_produk_sms s ON p.id_produk_iklan = s.produk_id
         WHERE p.id_produk_iklan = $1`,
        [id]
      );

      if (produkResult.rows.length === 0) {
        return res.status(404).send("Produk tidak ditemukan.");
      }

      const { kategori_id, sumber_nomor, jenis_target } = produkResult.rows[0];

      console.log("🧾 Data Produk:", { kategori_id, sumber_nomor, jenis_target });

      const pemesananResult = await pool.query(`
        INSERT INTO pemesanan (user_id, produk_id, kategori_id, jumlah_pemesanan,note_pemesanan_user)
        VALUES ($1, $2, $3, $4,$5)
        RETURNING id_pemesanan
      `, [userId, id, kategori_id, jumlah, catatan]);

      const id_pemesanan = pemesananResult.rows[0].id_pemesanan;
      console.log("📝 ID Pemesanan baru:", id_pemesanan);

      await pool.query(`
        INSERT INTO detail_pemesanan_sms (
          id_pemesanan,
          nomor_penerima_bukti_tayang,
          teks_iklan_sms,
          file_foto_mms,
          file_nomor_sms_pdf,
          alamat_target_sms,
          dps_latitude,
          dps_longitude,
          sumber_nomor,
          tanggal_pengiriman_start,
          tanggal_pengiriman_end,
          masking,
          target_umur,
          jam_pengiriman,
          tipe_device_penerima    
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      `, [
        id_pemesanan,
        nomor_penerima_bukti_tayang,
        teks_iklan_sms,
        (jenis_target === "MMS (Multimedia Messaging Service)" || jenis_target === "MMS LBA (Location-Based MMS)") ? file_foto_mms : null,
        sumber_nomor_from_user === "user" ? file_nomor_sms_csv : null,
        alamat_target_sms || null,
        latitude || null,
        longitude || null,
        sumber_nomor_from_user,
        tanggal_pengiriman_start,
        tanggal_pengiriman_end,
        masking_sender,
        target_umur,
        jam_kirim,
        Array.isArray(req.body.tipe_device) ? req.body.tipe_device.join(", ") : req.body.tipe_device || null,
      ]);

      console.log("✅ Pemesanan SMS berhasil disimpan.");
      res.redirect("/dalam-progress");

    } catch (err) {
      console.error("❌ Gagal simpan pemesanan SMS:", err);
      res.status(500).send("Terjadi kesalahan saat menyimpan.");
    }
  });
};


export const getOnProgress = async (req, res) => {
  try {
    const userId = req.user.id;

    const hasil = await pool.query(`
      SELECT 
        p.id_pemesanan,
        p.jumlah_pemesanan,
        p.note_pemesanan_user,
        p.note_pemesanan_vendor,
        p.status_pemesanan,
        p.tanggal_pemesanan,
        prod.nama_produk,
        prod.harga,
        prod.photo_produk,
        u.nama_toko_vendor,
        u.photo_vendor,
        us.photo_user,
        k.tipe_kategori
      FROM pemesanan p
      JOIN produk_iklan prod ON prod.id_produk_iklan = p.produk_id
      JOIN users_vendor u ON u.id_vendor = prod.vendor_id
      JOIN users us ON us.id = p.user_id
      JOIN kategori k ON k.kategori_id = p.kategori_id
      WHERE p.user_id = $1
          AND LOWER(p.status_pemesanan) NOT IN ('dibatalkan', 'selesai')
      ORDER BY p.tanggal_pemesanan DESC
    `, [userId]);

    const userPhoto = await pool.query("SELECT photo_user FROM users WHERE id = $1", [userId]);
    const idList = hasil.rows.map(row => row.id_pemesanan);
    const buktiTayangQuery = await pool.query(`
    SELECT id_pemesanan, file_bukti_tayang
    FROM bukti_tayang
    WHERE id_pemesanan = ANY($1)
    `, [idList]);

const buktiMap = {};
buktiTayangQuery.rows.forEach(row => {
  const ext = row.file_bukti_tayang.split('.').pop().toLowerCase();

  if (!buktiMap[row.id_pemesanan]) {
    buktiMap[row.id_pemesanan] = {
      dokumen: [], // satu array dulu, nanti dipecah di bawah sesuai kategori
      audio: []
    };
  }

  if (ext === 'pdf') {
    buktiMap[row.id_pemesanan].dokumen.push(row.file_bukti_tayang);
  } else if (['mp3', 'wav', 'ogg'].includes(ext)) {
    buktiMap[row.id_pemesanan].audio.push(row.file_bukti_tayang);
  }
})

    // merge ke hasil.rows
hasil.rows.forEach(row => {
  const bukti = buktiMap[row.id_pemesanan] || {};
  const dokumen = Array.isArray(bukti.dokumen) ? bukti.dokumen : [];
  const audio = Array.isArray(bukti.audio) ? bukti.audio : [];
 
  console.log(`🧠 ID ${row.id_pemesanan} kategori:`, row.tipe_kategori);
  row.audio_radio = audio;

  if (row.tipe_kategori === 'Radio') {
    row.dokumen_radio = dokumen;
    row.dokumen_sms = [];
  } else if (row.tipe_kategori === 'Messaging') {
    row.dokumen_sms = dokumen;
    row.dokumen_radio = [];
  } else {
    row.dokumen_sms = [];
    row.dokumen_radio = [];
  }
});

console.log("📦 Hasil data onProgress:");
hasil.rows.forEach(row => {
  console.log(`🧾 Pemesanan ${row.id_pemesanan}`);
  console.log(`   📄 dokumen_radio:`, row.dokumen_radio);
  console.log(`   🔊 audio_radio:`, row.audio_radio);
  console.log(`   📄 dokumen_sms :`, row.dokumen_sms);
});
    res.render("web/sudah_login/onProgress", {
      data: hasil.rows,
      user: userPhoto.rows[0]
    });

  } catch (err) {
    console.error("❌ Gagal ambil data progress:", err);
    res.status(500).send("Terjadi kesalahan saat mengambil data pemesanan.");
  }
};


export const getbuktiPemesananBy = async (req, res) => {
  const { id_pemesanan } = req.params;

  try {
    if (isNaN(id_pemesanan)) {
      return res.status(400).send("ID pemesanan tidak valid");
    }

    const pemesananQuery = await pool.query(`
      SELECT p.*, 
             u.full_name, u.nomor_tlp, u.email,
             pi.nama_produk, pi.photo_produk, pi.harga,
             k.tipe_kategori,
             uv.nama_toko_vendor,
             dps.jenis_target,
             jpr.hari AS hari_tayang
      FROM pemesanan p
      JOIN users u ON u.id = p.user_id
      JOIN produk_iklan pi ON pi.id_produk_iklan = p.produk_id
      JOIN kategori k ON k.kategori_id = p.kategori_id
      JOIN users_vendor uv ON uv.id_vendor = pi.vendor_id
      LEFT JOIN detail_produk_sms dps ON dps.produk_id = pi.id_produk_iklan
      LEFT JOIN jadwal_produk_radio jpr ON jpr.produk_id = pi.id_produk_iklan
      WHERE p.id_pemesanan = $1
    `, [id_pemesanan]);

    const pemesanan = pemesananQuery.rows[0];
    if (!pemesanan) return res.status(404).send('Pemesanan tidak ditemukan');

    const kategori = pemesanan.tipe_kategori?.toLowerCase() || '';
    const target = pemesanan.jenis_target?.toLowerCase() || '';

    let detailSMS = null;
    let slotTayang = [];
    let hariMerah = [];
    let detailRadio = [];
    let jadwalProdukRadio = [];

    // 📅 Jika kategori radio
    if (kategori === 'radio') {
      const jadwalQuery = await pool.query(`
        SELECT * FROM jadwal_produk_radio
        WHERE produk_id = $1
      `, [pemesanan.produk_id]);

      jadwalProdukRadio = jadwalQuery.rows;

      const detailRadioQuery = await pool.query(`
        SELECT tanggal_tayang_pemesanan_radio, jam_tayang_pemesanan_radio 
        FROM detail_pemesanan_radio
        WHERE id_pemesanan = $1
      `, [id_pemesanan]);

      detailRadio = detailRadioQuery.rows;

      slotTayang = detailRadio.map(slot => {
        const tanggal = new Date(slot.tanggal_tayang_pemesanan_radio);
        const yyyy = tanggal.getFullYear();
        const mm = String(tanggal.getMonth() + 1).padStart(2, '0');
        const dd = String(tanggal.getDate()).padStart(2, '0');
        const tanggalFormatted = `${yyyy}-${mm}-${dd}`;

        const jamFormatted = slot.jam_tayang_pemesanan_radio.slice(0, 5); // 02:23

        return {
          title: "Tayang",
          start: `${tanggalFormatted}T${jamFormatted}`
        };
      });

      const hariIndo = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
      const hariBoleh = (pemesanan.hari_tayang || "")
        .toLowerCase()
        .split(",")
        .map(h => h.trim());
      hariMerah = hariIndo
        .map((hari, index) => ({ hari, index }))
        .filter(obj => !hariBoleh.includes(obj.hari))
        .map(obj => obj.index);

      // ✅ Logging untuk debugging
      console.log("📻 [DEBUG] Detail radio:", detailRadio);
      console.log("📆 [DEBUG] Slot tayang:", slotTayang);
      console.log("🟥 [DEBUG] Hari merah:", hariMerah);
    }

    // 📩 Jika kategori SMS
    const isTargetSMS = ['sms', 'mms', 'lba'].some(key => target.includes(key));
    if (kategori === 'messaging' && isTargetSMS) {
      const detailQuery = await pool.query(`
        SELECT * FROM detail_pemesanan_sms
        WHERE id_pemesanan = $1
      `, [id_pemesanan]);
      detailSMS = detailQuery.rows[0];

      // ✅ Debug log SMS
      console.log("📩 [DEBUG] Detail SMS:", detailSMS);
    }

    res.render('web/sudah_login/bukti_pemesanan', {
      pemesanan,
      detailSMS,
      detailRadio,
      jadwalProdukRadio,
      slotTayang: JSON.stringify(slotTayang),
      hariMerah: JSON.stringify(hariMerah),
      googleMapsApiKey: process.env.Maps_API,
      eventRadio: slotTayang,
      hariTayangRadio: hariMerah
    });
  } catch (err) {
    console.error('❌ Gagal mengambil data invoice:', err.message);
    res.status(500).send('Terjadi kesalahan saat mengambil invoice.');
  }
};




export const batalPemesanan = async (req, res) => {
  try {
    const { id } = req.params;
    const query = `UPDATE pemesanan SET status_pemesanan = 'dibatalkan' WHERE id_pemesanan = $1`;
    await pool.query(query, [id]);
    res.redirect("/dalam-progress");
  } catch (err) {
    console.error("❌ Gagal membatalkan pesanan:", err);
    res.status(500).send("Gagal membatalkan pemesanan.");
  }
};

export const selesaikanPemesanan = async (req, res) => {
  const { id_pemesanan } = req.body;

  try {
    // Validasi awal
    if (!id_pemesanan) {
      return res.status(400).json({ message: "ID pemesanan tidak valid." });
    }

    // Update status
    await pool.query(`
      UPDATE pemesanan
      SET status_pemesanan = 'selesai'
      WHERE id_pemesanan = $1
    `, [id_pemesanan]);

    console.log(`✅ Pemesanan ${id_pemesanan} berhasil diupdate ke 'selesai'`);

    res.json({ message: "Pemesanan berhasil diselesaikan." });
  } catch (err) {
    console.error("❌ Gagal menyelesaikan pemesanan:", err);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};


// 🔧 Setup folder upload untuk RADIO
const folderRadio = "./public/uploads/radio_files/";
if (!fs.existsSync(folderRadio)) {
  fs.mkdirSync(folderRadio, { recursive: true });
}

// 🎯 Setup Multer storage khusus RADIO
const storageRadio = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, folderRadio);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

// ✅ Filter file radio
const fileFilterRadio = (req, file, cb) => {
  const allowedScript = ["application/pdf"];
  const allowedAudio = ["audio/mpeg", "audio/mp3", "audio/wav"];

  if (
    (file.fieldname === "file_script" && allowedScript.includes(file.mimetype)) ||
    (file.fieldname === "file_audio" && allowedAudio.includes(file.mimetype))
  ) {
    cb(null, true);
  } else {
    cb(new Error("Tipe file tidak diizinkan untuk radio"), false);
  }
};

// 🔘 Multer instance khusus RADIO
export const uploadRadioFiles = multer({
  storage: storageRadio,
  fileFilter: fileFilterRadio
}).fields([
  { name: "file_script", maxCount: 1 },
  { name: "file_audio", maxCount: 1 }
]);

// 🔽 Radio Pesan
export const handlePesanRadio = (req, res) => {
  uploadRadioFiles(req, res, async function (err) {
    if (err) {
      console.error("❌ Upload error:", err);
      return res.status(400).send("Gagal upload file");
    }

    try {
      const { jumlah_pemesanan = 1, slot_dipilih = [] } = req.body;
      const user_id = req.user.id;
      const produk_id = req.params.id;

      console.log("📥 Slot dipilih:", slot_dipilih);
      console.log("📥 User ID:", user_id);
      console.log("📥 Produk ID:", produk_id);

      // Simpan ke tabel pemesanan
      const resultPemesanan = await pool.query(
        `INSERT INTO pemesanan (user_id, produk_id, kategori_id, jumlah_pemesanan) 
         VALUES ($1, $2, (SELECT kategori_id FROM produk_iklan WHERE id_produk_iklan = $2), $3) RETURNING id_pemesanan`,
        [user_id, produk_id, jumlah_pemesanan]
      );
      const id_pemesanan = resultPemesanan.rows[0].id_pemesanan;

      // Simpan slot ke detail_pemesanan_radio
      const slotArray = Array.isArray(slot_dipilih) ? slot_dipilih : [slot_dipilih];
      for (const s of slotArray) {
        const slot = JSON.parse(s);
        const tanggal = slot.start.split("T")[0];
        const jam = slot.start.split("T")[1].slice(0, 5);
        await pool.query(
          `INSERT INTO detail_pemesanan_radio (id_pemesanan, tanggal_tayang_pemesanan_radio, jam_tayang_pemesanan_radio)
           VALUES ($1, $2, $3)`,
          [id_pemesanan, tanggal, jam]
        );
      }

      // Simpan file ke file_pemesanan_radio
      const file_script = req.files["file_script"]?.[0]?.filename || null;
      const file_audio = req.files["file_audio"]?.[0]?.filename || null;

      await pool.query(
        `INSERT INTO file_pemesanan_radio (id_pemesanan, file_script, file_audio) 
         VALUES ($1, $2, $3)`,
        [id_pemesanan, file_script, file_audio]
      );

      res.redirect("/dalam-progress"); // arahkan ke halaman progress
    } catch (error) {
      console.error("❌ Gagal menyimpan pesanan:", error);
      res.status(500).send("Terjadi kesalahan saat memproses pemesanan");
    }
  });
};


export const halamanPembayaran = async (req, res) => {
  const { id_pemesanan } = req.params;
  console.log("📦 ID Pemesanan:", id_pemesanan);
  const userId = req.user.id;
  const user = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
  try {
    // 1. Ambil info dasar produk dan kategori
    const result = await pool.query(`
      SELECT 
        p.id_pemesanan,
        pi.nama_produk,
        pi.photo_produk,
        pi.harga,
        p.jumlah_pemesanan,
        k.tipe_kategori,
        (pi.harga * p.jumlah_pemesanan) AS total_harga
      FROM pemesanan p
      LEFT JOIN  produk_iklan pi ON pi.id_produk_iklan = p.produk_id
      JOIN kategori k ON k.kategori_id = p.kategori_id
      WHERE p.id_pemesanan = $1
    `, [id_pemesanan]);

    console.log("🔍 Hasil query produk:", result.rows);

    if (result.rowCount === 0) {
      console.warn("⚠️ Tidak ditemukan data pemesanan.");
      return res.status(404).send("Data pemesanan tidak ditemukan.");
    }

    const produk = result.rows[0];
    console.log("✅ Produk ditemukan:", produk);

    // 2. Ambil jadwal sesuai kategori
    let jadwal = '';

    if (produk.tipe_kategori.toLowerCase() === 'messaging') {
      console.log("📨 Kategori: Messaging");
      const sms = await pool.query(`
        SELECT tanggal_pengiriman_start, tanggal_pengiriman_end, jam_pengiriman
        FROM detail_pemesanan_sms
        WHERE id_pemesanan = $1
      `, [id_pemesanan]);

      console.log("📅 Jadwal SMS:", sms.rows);

      if (sms.rowCount > 0) {
        const d = sms.rows[0];
        jadwal = `${d.tanggal_pengiriman_start.toLocaleDateString('id-ID')} s/d ${d.tanggal_pengiriman_end.toLocaleDateString('id-ID')} pukul ${d.jam_pengiriman}`;
      }

    } else if (produk.tipe_kategori.toLowerCase() === 'radio') {
      console.log("📻 Kategori: Radio");
      const radio = await pool.query(`
        SELECT tanggal_tayang_pemesanan_radio, jam_tayang_pemesanan_radio
        FROM detail_pemesanan_radio
        WHERE id_pemesanan = $1
        ORDER BY tanggal_tayang_pemesanan_radio ASC, jam_tayang_pemesanan_radio ASC
      `, [id_pemesanan]);

      console.log("📅 Jadwal Radio:", radio.rows);

      if (radio.rowCount > 0) {
        jadwal = radio.rows.map(r => {
          const tgl = r.tanggal_tayang_pemesanan_radio.toLocaleDateString('id-ID');
          const jam = r.jam_tayang_pemesanan_radio;
          return `- ${tgl} pukul ${jam}`;
        }).join('<br>');
      }
    }

    const total_harga = produk.harga * produk.jumlah_pemesanan;

// Ambil semua pembayaran sebelumnya (jika ada)
const pembayaranResult = await pool.query(`
  SELECT jumlah_bayar, waktu_dibayar, bukti_pembayaran, status_pembayaran, sisa_tagihan
  FROM pembayaran
  WHERE id_pemesanan = $1
  ORDER BY waktu_dibayar ASC
`, [id_pemesanan]);

let pembayaranSebelumnya = [];

pembayaranResult.rows.forEach((p) => {
  let jumlah_ditampilkan = p.jumlah_bayar;

  // Jika ada sisa_tagihan, kurangi dari total bayar untuk tampilkan hanya yang dianggap "benar dibayar"
  if (p.status_pembayaran === 'jumlah pembayaran tidak sesuai' && p.sisa_tagihan) {
    jumlah_ditampilkan = p.jumlah_bayar - p.sisa_tagihan;
  }

  pembayaranSebelumnya.push({
    jumlah_ditampilkan,
    waktu_dibayar: p.waktu_dibayar,
    kekurangan: p.sisa_tagihan || null
  });
});


    // 3. Siapkan data untuk EJS
    console.log("📤 Data yang dikirim ke EJS:", {
      id_pemesanan,
      produk: {
        ...produk,
        jadwal: jadwal,
        jumlah: produk.jumlah_pemesanan
      }
    });

    res.render('web/sudah_login/pembayaran', {
      id_pemesanan,
      dataUser: user.rows[0],
      token: req.query.token || "",
      produk: {
        ...produk,
        jadwal: jadwal,
        jumlah: produk.jumlah_pemesanan
      },
      pembayaranSebelumnya,
      sisa_tagihan: total_harga - pembayaranSebelumnya.reduce((acc, p) => acc + p.jumlah_ditampilkan, 0)
    });

  } catch (error) {
    console.error("❌ Gagal mengambil data pembayaran:", error);
    res.status(500).send("Terjadi kesalahan saat menampilkan halaman pembayaran.");
  }
};


const storageBuktiPembayaran = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "public/uploads/bukti_pembayaran";
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const unique = Math.floor(1000 + Math.random() * 9000); // 4 digit acak
    const filename = `bukti_${Date.now()}_${unique}${ext}`;
    cb(null, filename);
  },
});

const fileFilterBuktiPembayaran = (req, file, cb) => {
  const allowedMime = ['image/jpeg', 'image/png'];
  if (allowedMime.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("❌ Format file tidak valid. Hanya .jpg dan .png"), false);
  }
};

const uploadPembayaran = multer({
  storage: storageBuktiPembayaran,
  fileFilter: fileFilterBuktiPembayaran
}).single("bukti_pembayaran");


// 🚀 Controller upload dan simpan bukti
export const uploadBuktiPembayaran = (req, res) => {
  uploadPembayaran(req, res, async function (err) {
    const { id_pemesanan, token } = req.body;

    if (err) return res.status(400).send(err.message);
    if (!req.file) return res.status(400).send("❌ File bukti pembayaran tidak ditemukan.");

    // ✅ Cek identitas user (login biasa vs token dari email)
    if (!req.user) {
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          req.user = {
            id: decoded.user_id,
            role: decoded.role,
          };

          if (decoded.id_pemesanan != id_pemesanan) {
            return res.status(403).send("❌ Token tidak cocok dengan ID pemesanan.");
          }
        } catch (err) {
          console.warn("❌ Token pembayaran tidak valid:", err);
          return res.status(403).send("❌ Token pembayaran tidak valid atau kadaluarsa.");
        }
      } else {
        return res.status(401).send("❌ Akses tidak diizinkan. Login atau gunakan link email.");
      }
    }

    const fileName = req.file.filename;
    const waktuBayar = new Date();

    try {
      // ✅ Ambil total harga pemesanan
      const pemesananQuery = await pool.query(`
        SELECT jumlah_pemesanan, pi.harga
        FROM pemesanan p
        JOIN produk_iklan pi ON pi.id_produk_iklan = p.produk_id
        WHERE p.id_pemesanan = $1
      `, [id_pemesanan]);

      if (pemesananQuery.rowCount === 0) {
        return res.status(404).send("❌ Data pemesanan tidak ditemukan.");
      }

      const { jumlah_pemesanan, harga } = pemesananQuery.rows[0];
      const total_harga = jumlah_pemesanan * harga;

      // ✅ Hitung total yang valid sudah dibayar sebelumnya
      const bayarSebelumnya = await pool.query(`
        SELECT 
          COALESCE(SUM(
            CASE 
              WHEN status_pembayaran = 'jumlah pembayaran tidak sesuai' AND sisa_tagihan IS NOT NULL
                THEN jumlah_bayar - sisa_tagihan
              ELSE jumlah_bayar
            END
          ), 0) AS total_dibayar
        FROM pembayaran
        WHERE id_pemesanan = $1
      `, [id_pemesanan]);

      const total_dibayar = parseInt(bayarSebelumnya.rows[0].total_dibayar);

      // ✅ Hitung jumlah yang harus dibayar (sisa)
      const jumlah_bayar = total_harga - total_dibayar;

      // 💾 Simpan ke tabel pembayaran dengan status default "menunggu pengecekan"
      await pool.query(`
        INSERT INTO pembayaran (id_pemesanan, jumlah_bayar, waktu_dibayar, bukti_pembayaran, status_pembayaran)
        VALUES ($1, $2, $3, $4, $5)
      `, [id_pemesanan, jumlah_bayar, waktuBayar, fileName, "menunggu pengecekan"]);

      // 🔁 Update status pemesanan
      await pool.query(`
        UPDATE pemesanan
        SET status_pemesanan = 'menunggu verifikasi pembayaran'
        WHERE id_pemesanan = $1
      `, [id_pemesanan]);

      if (req.cookies.token) {
        // User login biasa
        return res.redirect("/dalam-progress");
      } else {
        // ✅ Dari email token – kirim HTML + SweetAlert
        return res.send(`
          <html>
            <head>
              <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            </head>
            <body>
              <script>
                Swal.fire({
                  icon: 'success',
                  title: 'Pembayaran berhasil!',
                  text: 'Silakan login untuk melanjutkan.',
                  confirmButtonText: 'Login',
                }).then(() => {
                  window.location.href = '/login-user';
                });
              </script>
            </body>
          </html>
        `);
      }
    } catch (error) {
      console.error("❌ Gagal proses bukti pembayaran:", error);
      res.status(500).send("Terjadi kesalahan saat menyimpan data pembayaran.");
    }
  });
};

export const verifyPembayaranToken = (req, res, next) => {
  const token = req.query.token;
  if (!token) {
    return res.status(401).send("❌ Akses tidak diizinkan. Token tidak ditemukan.");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Set user manual ke req.user agar bisa dipakai di controller pembayaran
    req.user = {
      id: decoded.user_id,
      role: decoded.role,
    };

    next();
  } catch (err) {
    console.error("❌ Token tidak valid:", err);
    return res.status(403).send("❌ Token tidak valid atau kadaluarsa.");
  }
};


export const halamanPenyesuaianSMS = async (req, res) => {
  const { id_pemesanan } = req.params;
  try {
    const result = await pool.query(`
      SELECT p.*, 
             dps.*, 
             pi.nama_produk, 
             pi.photo_produk,
             pi.harga, 
             k.tipe_kategori,
             s.jenis_target AS sms_jenis_target,
             v.nama_toko_vendor,
             v.photo_vendor,
             s.provider_yang_di_layani,
             pk.kota
      FROM pemesanan p
      LEFT JOIN detail_pemesanan_sms dps ON dps.id_pemesanan = p.id_pemesanan
      LEFT JOIN produk_iklan pi ON p.produk_id = pi.id_produk_iklan
      LEFT JOIN kategori k ON p.kategori_id = k.kategori_id
      LEFT JOIN detail_produk_sms s ON pi.id_produk_iklan = s.produk_id
      JOIN users_vendor v ON pi.vendor_id = v.id_vendor
      LEFT JOIN pks pk ON v.pks_id = pk.pks_id
      WHERE p.id_pemesanan = $1
    `, [id_pemesanan]);

    if (result.rows.length === 0) return res.status(404).send("Pemesanan tidak ditemukan.");

    const data = result.rows[0];

    res.render('web/sudah_login/penyesuain_pesanan_sms', { 
      produk: data, 
      dataUser: req.user, 
      googleMapsApiKey: process.env.Maps_API
    });

  } catch (err) {
    console.error("❌ Gagal ambil data penyesuaian:", err);
    res.status(500).send("Terjadi kesalahan saat memuat halaman penyesuaian.");
  }
};


// login end 