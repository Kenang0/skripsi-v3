import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../../db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { findUserByEmailKlien, findUserByRole } from "../dashAdminController/authAdmin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// testing sesuatu start
// buat melihat front end aja seblum masuk data kalau masih fornt end aja 
export const liatFrontEnd = async (req, res) => {
  res.render('register_user', {
    // data: [], 
    // error: "" 
    token: ""
  });
}
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

// halaman produk 
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
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Format file tidak didukung"));
    }
  }
});


const uploadFields = uploadSMSFiles.fields([
  { name: "file_foto_mms", maxCount: 1 },
  { name: "file_nomor_sms_pdf", maxCount: 1 }
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
      const file_nomor_sms_pdf = req.files["file_nomor_sms_pdf"]?.[0]?.filename || null;

      console.log("🛩️ Incoming request from user:", userId);
      console.log("📦 Produk ID:", id);
      console.log("📞 nomor penerima:", nomor_penerima_bukti_tayang);
      console.log("📩 Teks iklan:", teks_iklan_sms);
      console.log("🗂️ File foto MMS:", file_foto_mms);
      console.log("📄 File nomor PDF:", file_nomor_sms_pdf);
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
        sumber_nomor_from_user === "user" ? file_nomor_sms_pdf : null,
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
      res.redirect("/dashboard");

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
        p.status_pemesanan,
        p.tanggal_pemesanan,
        prod.nama_produk,
        prod.harga,
        prod.photo_produk,
        u.nama_toko_vendor,
        u.photo_vendor
      FROM pemesanan p
      JOIN produk_iklan prod ON prod.id_produk_iklan = p.produk_id
      JOIN users_vendor u ON u.id_vendor = prod.vendor_id
      WHERE p.user_id = $1
        AND LOWER(p.status_pemesanan) != 'dibatalkan'
      ORDER BY p.tanggal_pemesanan DESC
    `, [userId]);

    res.render("web/sudah_login/onProgress", {
      data: hasil.rows
    });

  } catch (err) {
    console.error("❌ Gagal ambil data progress:", err);
    res.status(500).send("Terjadi kesalahan saat mengambil data pemesanan.");
  }
};


export const getbuktiPemesananBy = async (req, res) => {
  const { id_pemesanan } = req.params;

  console.log("📦 Param id_pemesanan yang diterima:", id_pemesanan);

  try {
    // Debug validasi awal
    if (isNaN(id_pemesanan)) {
      console.warn("⚠️ ID pemesanan harus angka. Diterima:", id_pemesanan);
      return res.status(400).send("ID pemesanan tidak valid (bukan angka).");
    }

    const pemesananQuery = await pool.query(`
  SELECT p.*, 
         u.full_name, u.nomor_tlp, u.email,
         pi.nama_produk, pi.photo_produk, pi.harga,
         k.tipe_kategori,
         uv.nama_toko_vendor,
         dps.jenis_target
  FROM pemesanan p
  JOIN users u ON u.id = p.user_id
  JOIN produk_iklan pi ON pi.id_produk_iklan = p.produk_id
  JOIN kategori k ON k.kategori_id = p.kategori_id
  JOIN users_vendor uv ON uv.id_vendor = pi.vendor_id
  LEFT JOIN detail_produk_sms dps ON dps.produk_id = pi.id_produk_iklan
  WHERE p.id_pemesanan = $1
`, [parseInt(id_pemesanan)]);


    console.log("✅ Data pemesanan ditemukan:", pemesananQuery.rows);

    const pemesanan = pemesananQuery.rows[0];
    if (!pemesanan) return res.status(404).send('Pemesanan tidak ditemukan');

    // Ambil detail SMS jika kategori = SMS
    let detailSMS = null;
    const kategori = pemesanan.tipe_kategori.toLowerCase();
    const target = pemesanan.jenis_target?.toLowerCase() || '';
    console.log("🎯 Kategori:", kategori, "| Target:", target);

    const isTargetSMS = ['sms', 'mms', 'lba'].some(key => target.includes(key));

    if (kategori === 'messaging' && isTargetSMS) {
      const detailQuery = await pool.query(`
    SELECT * FROM detail_pemesanan_sms
    WHERE id_pemesanan = $1
  `, [id_pemesanan]);

      detailSMS = detailQuery.rows[0];
      console.log("📄 Detail SMS ditemukan:", detailSMS);
    }
    else if (kategori === 'radio') {
      // ambil detail radio kalau sudah tersedia
    }

    res.render('web/sudah_login/bukti_pemesanan', {
      pemesanan,
      detailSMS,
      googleMapsApiKey: process.env.Maps_API
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



// login end 