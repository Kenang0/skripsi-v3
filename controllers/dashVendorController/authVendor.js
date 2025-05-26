import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../../db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { error } from "console";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

//  multer upload produk 
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folderPath = "public/uploads/produk_img";
    fs.mkdirSync(folderPath, { recursive: true });
    cb(null, folderPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const cleanName = req.body.nama_produk?.replace(/\s+/g, "_").toLowerCase() || "produk";
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
    cb(null, `${cleanName}_${timestamp}${ext}`);
  }
});

const upload = multer({ storage }).single("photo_produk");

// ngambil login page vendor
export const getLoginPageVendor = (req, res) => {
  res.render("loginVendor", { error: null });
};

// mencari email dari tabel user
export const findUserByEmail = async (email_vendor) => {
  const query = "SELECT * FROM users_vendor WHERE email_vendor = $1";
  const result = await pool.query(query, [email_vendor]);
  return result.rows[0];
};

// buat login vendor simpan id sama nama_toko di token
export const loginUserVendor = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user_vendor = await findUserByEmail(email);
    if (!user_vendor) {
      return res.render("loginVendor", { error: "Invalid email atau password" });
    }

    const isMatch = await bcrypt.compare(password, user_vendor.password_vendor);
    if (!isMatch) {
      return res.render("loginVendor", { error: "Invalid email atau password" });
    }

    const token = jwt.sign(
      { id: user_vendor.id_vendor, nama_toko_vendor: user_vendor.nama_toko_vendor },
      process.env.JWT_SECRET,
      { expiresIn: "3h" }
    );
    res.cookie("token", token, { httpOnly: true });
    res.redirect("/vendor/dashboardVendor");
  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
};


// ngambil halaman home dash vendor
export const getDashVendorHome = async (req, res) => {
  res.render("dashVendor/dashboardVendor", {
    partial: 'HomeVendor',
    data: "",
    error: ""
  });

};

// ngambil halaman tambah produk
export const getTambahProduk = async (req, res) => {
  try {
    const kategori = await pool.query("SELECT * FROM kategori");
    res.render("dashVendor/dashboardVendor", {
      partial: './produk/tambahProduk',
      data: kategori.rows,
      error: ""
    });
  } catch (err) {
    console.error("Gagal ambil kategori:", err);
    res.status(500).send("Gagal mengambil data kategori.");
  }
};


// buat submit tombol di halaman tambah produk
export const postTambahProduk = async (req, res) => {

  upload(req, res, async function (err) {
    if (err) {
      console.error("❌ Upload error:", err);
      return res.status(500).send("Gagal mengunggah foto produk.");
    }

    const vendor_id = req.user.id;
    const { kategori_id, nama_produk, deskripsi_produk, harga } = req.body;
    const photo_produk = req.file ? req.file.filename : null;
    console.log("🔥 req.user:", req.user);
    console.log("📦 req.body:", req.body);
    try {
      // 1. Simpan ke produk_iklan
      const result = await pool.query(
        `INSERT INTO produk_iklan (vendor_id, kategori_id, nama_produk, deskripsi_produk, harga, status_produk, photo_produk)
       VALUES ($1, $2, $3, $4, $5, $6,$7)
       RETURNING id_produk_iklan`,
        [vendor_id, kategori_id, nama_produk, deskripsi_produk, harga, 'aktif', photo_produk]
      );

      const produkIdBaru = result.rows[0].id_produk_iklan;

      // === KATEGORI: RADIO ===
      if (kategori_id === "1") {
        const { jam_mulai, jam_selesai, hari_tayang } = req.body;

        // Gabungkan semua hari menjadi satu string dipisah koma
        const hariGabung = Array.isArray(hari_tayang) ? hari_tayang.join(",") : hari_tayang;


        await pool.query(
          `INSERT INTO jadwal_produk_radio (produk_id, hari, jam_mulai, jam_selesai)
           VALUES ($1, $2, $3, $4)`,
          [produkIdBaru, hariGabung, jam_mulai, jam_selesai]
        );

      }

      // === KATEGORI: SMS ===
      if (kategori_id === "2") {
        const { provider, jenis_target } = req.body;

        // Gabungkan semua hari menjadi satu string dipisah koma
        const providerGabung = Array.isArray(provider) ? provider.join(",") : provider;


        await pool.query(
          `INSERT INTO detail_produk_sms (produk_id, provider_yang_di_layani, jenis_target)
           VALUES ($1, $2, $3)`,
          [produkIdBaru, providerGabung, jenis_target]
        );

      }

      res.redirect("/vendor/dashboardVendor/tambahproduk");
    } catch (err) {
      console.error("Gagal simpan produk:", err);
      res.status(500).send("Terjadi kesalahan saat menyimpan produk.");
    }
  });
};

// Halaman CRUD buat produk vendor dari tabelnya
export const getProdukVendor = async (req, res) => {
  try {
    const idVendor = req.user?.id;

    if (!idVendor) {
      return res.status(403).send("Akses ditolak: ID Vendor tidak ditemukan");
    }

    const query = `
      SELECT
        produk_iklan.*,
        kategori.tipe_kategori,
        jadwal_produk_radio.hari,
        jadwal_produk_radio.jam_mulai,
        jadwal_produk_radio.jam_selesai,
        detail_produk_sms.provider_yang_di_layani,
        detail_produk_sms.jenis_target
      FROM produk_iklan
      JOIN kategori ON kategori.kategori_id = produk_iklan.kategori_id
      LEFT JOIN jadwal_produk_radio ON produk_iklan.id_produk_iklan = jadwal_produk_radio.produk_id
      LEFT JOIN detail_produk_sms ON produk_iklan.id_produk_iklan = detail_produk_sms.produk_id
      WHERE produk_iklan.vendor_id = $1
      ORDER BY produk_iklan.produk_iklan_dibuat DESC
    `;

    const hasil = await pool.query(query, [idVendor]);

    const semuaProduk = hasil.rows;

    // Filter berdasarkan kategori
    const produkRadio = semuaProduk.filter(p => p.tipe_kategori === "Radio");
    const produkSMS = semuaProduk.filter(p => p.tipe_kategori === "Messaging");


    const dataFilter = {
      radio: produkRadio,
      sms: produkSMS
    };

    console.log("📦 Produk Radio:", produkRadio.length);
    console.log("📦 Produk SMS:", produkSMS.length);

    res.render("dashVendor/dashboardVendor", {
      data: dataFilter,
      error: null,
      partial: "produk/produk_vendor_view",
    });

  } catch (err) {
    console.error("❌ Error ambil produk vendor:", err.message);
    res.status(500).send("Terjadi kesalahan server");
  }
};

export const deleteProdukRadio = async (req, res) => {
  const id = req.params.id;
  console.log("🧪 ID yang diterima:", id);

  try {
    await pool.query("BEGIN");

    // Ambil nama file fotonya dulu
    const result = await pool.query("SELECT photo_produk FROM produk_iklan WHERE id_produk_iklan = $1", [id]);
    const photoFile = result.rows[0]?.photo_produk;

    // Hapus jadwal + produk
    await pool.query("DELETE FROM jadwal_produk_radio WHERE produk_id = $1", [id]);
    await pool.query("DELETE FROM produk_iklan WHERE id_produk_iklan = $1", [id]);

    // Hapus file jika ada
    if (photoFile) {
      const filePath = path.join("public", "uploads", "produk_img", photoFile);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await pool.query("COMMIT");
    res.json({ success: true, message: "Produk radio berhasil dihapus." });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("❌ Gagal hapus produk radio:", err);
    res.status(500).json({ success: false, message: "Gagal menghapus produk radio." });
  }
};


export const deleteProdukSMS = async (req, res) => {
  const id = req.params.id;

  try {
    await pool.query("BEGIN");

    // Ambil nama file
    const result = await pool.query("SELECT photo_produk FROM produk_iklan WHERE id_produk_iklan = $1", [id]);
    const photoFile = result.rows[0]?.photo_produk;

    await pool.query("DELETE FROM detail_produk_sms WHERE produk_id = $1", [id]);
    await pool.query("DELETE FROM produk_iklan WHERE id_produk_iklan = $1", [id]);

    if (photoFile) {
      const filePath = path.join("public", "uploads", "produk_img", photoFile);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await pool.query("COMMIT");
    res.json({ success: true, message: "Produk SMS berhasil dihapus." });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("❌ Gagal hapus produk SMS:", err);
    res.status(500).json({ success: false, message: "Gagal menghapus produk SMS." });
  }
};

export const updateProduk = async (req, res) => {
  const id = req.params.id;

  const {
    nama_produk,
    deskripsi_produk,
    harga,
    status_produk,
    hari,              // array (khusus radio)
    jam_mulai,         // khusus radio
    jam_selesai,       // khusus radio
    provider,          // array (khusus sms)
    jenis_target       // khusus sms
  } = req.body;

  // ✅ Normalisasi agar aman meski cuma 1 nilai dikirim
  const hariArray = Array.isArray(hari) ? hari : hari ? [hari] : [];
  const providerArray = Array.isArray(provider) ? provider : provider ? [provider] : [];
  console.log("🛠️ ID Produk:", id);
   console.log("🛠️ hargaProduk:", harga);
  console.log("📥 Hari (radio):", hari);
  console.log("📥 Hari (radio):", hariArray);
  
  console.log("📥 Jam Mulai:", jam_mulai);
  console.log("📥 Jam Selesai:", jam_selesai);
  console.log("📥 Provider (sms):", provider);
  console.log("📥 Provider (sms):", providerArray);
  console.log("📥 Jenis Target:", jenis_target);
  try {
    await pool.query("BEGIN");

    // Update umum di produk_iklan
    await pool.query(
      `UPDATE produk_iklan SET 
        nama_produk = $1, 
        deskripsi_produk = $2, 
        harga = $3, 
        status_produk = $4 
      WHERE id_produk_iklan = $5`,
      [nama_produk, deskripsi_produk, harga, status_produk, id]
    );

    // Cek kategori produk (radio jika ada entri di jadwal)
    const cekRadio = await pool.query(`SELECT * FROM jadwal_produk_radio WHERE produk_id = $1`, [id]);
    const isRadio = cekRadio.rows.length > 0;

    if (isRadio) {
      const hariGabung = hariArray.join(",");
      await pool.query(
        `UPDATE jadwal_produk_radio 
         SET hari = $1, jam_mulai = $2, jam_selesai = $3 
         WHERE produk_id = $4`,
        [hariGabung, jam_mulai, jam_selesai, id]
      );
    } else {
      const providerGabung = providerArray.join(",");
      await pool.query(
        `UPDATE detail_produk_sms SET 
          provider_yang_di_layani = $1, 
          jenis_target = $2 
        WHERE produk_id = $3`,
        [providerGabung, jenis_target, id]
      );
    }

    await pool.query("COMMIT");
    res.json({ message: "Produk berhasil diperbarui" });

  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("❌ Error update produk:", err);
    res.status(500).json({ message: "Gagal memperbarui produk" });
  }
};


export const getOnProgressVendor = async (req, res) => {
  try {
    const vendorId = req.user.id;

    console.log("📦 ID Vendor Login:", vendorId);

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
        u.full_name AS nama_klien,
        u.photo_user,
        u.email,
        u.nomor_tlp
      FROM pemesanan p
      JOIN produk_iklan prod ON prod.id_produk_iklan = p.produk_id
      JOIN users u ON u.id = p.user_id
      WHERE prod.vendor_id = $1
        AND LOWER(p.status_pemesanan) != 'dibatalkan'
      ORDER BY p.tanggal_pemesanan DESC
    `, [vendorId]);

    console.log(`✅ ${hasil.rowCount} pesanan ditemukan untuk vendor ${vendorId}`);
    console.table(hasil.rows.map(p => ({
      id: p.id_pemesanan,
      produk: p.nama_produk,
      status: p.status_pemesanan,
      klien: p.nama_klien
    })));

    res.render("dashVendor/dashboardVendor", {
      data: hasil.rows,
      partial: "dalam_progress",
      error: ""
    });

  } catch (err) {
    console.error("❌ Gagal ambil data progress vendor:", err);
    res.status(500).send("Terjadi kesalahan saat mengambil data pemesanan vendor.");
  }
};






