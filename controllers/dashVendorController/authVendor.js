import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../../db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { error } from "console";
import ejs from "ejs";
import puppeteer from "puppeteer";
import { transporter } from "../../nodemailer.js";

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
        const { jam_mulai, jam_selesai, hari_tayang, slot_penayangan } = req.body;

        // Gabung semua hari menjadi satu string dipisah koma
        const hariGabung = Array.isArray(hari_tayang) ? hari_tayang.join(",") : hari_tayang;


        await pool.query(
          `INSERT INTO jadwal_produk_radio (produk_id, hari, jam_mulai, jam_selesai,slot_penayangan)
           VALUES ($1, $2, $3, $4,$5)`,
          [produkIdBaru, hariGabung, jam_mulai, jam_selesai, slot_penayangan]
        );

      }

      // === KATEGORI: SMS ===
      if (kategori_id === "2") {
        const { provider, jenis_target } = req.body;

        // Gabung hari menjadi satu string dipisah koma
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
        jadwal_produk_radio.slot_penayangan,
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

    
    const result = await pool.query("SELECT photo_produk FROM produk_iklan WHERE id_produk_iklan = $1", [id]);
    const photoFile = result.rows[0]?.photo_produk;

    
    await pool.query("DELETE FROM jadwal_produk_radio WHERE produk_id = $1", [id]);
    await pool.query("DELETE FROM produk_iklan WHERE id_produk_iklan = $1", [id]);

    
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
 
    const cek = await pool.query("SELECT 1 FROM pemesanan WHERE produk_id = $1 LIMIT 1", [id]);
    if (cek.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Produk tidak bisa dihapus karena sudah pernah dipesan.",
      });
    }

    await pool.query("BEGIN");

   
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
  upload(req, res, async function (err) {
    if (err) {
      return res.status(500).json({ message: "Gagal upload gambar." });
    }

    const id = req.params.id;
    const {
      nama_produk,
      deskripsi_produk,
      harga,
      status_produk,
      hari,
      jam_mulai,
      jam_selesai,
      provider,
      jenis_target,
      slot_penayangan
    } = req.body;

    const hariArray = Array.isArray(hari) ? hari : hari ? [hari] : [];
    const providerArray = Array.isArray(provider) ? provider : provider ? [provider] : [];

    try {
      await pool.query("BEGIN");

      let queryProduk = `
        UPDATE produk_iklan SET 
          nama_produk = $1, 
          deskripsi_produk = $2, 
          harga = $3, 
          status_produk = $4
      `;
      const params = [nama_produk, deskripsi_produk, harga, status_produk];

      if (req.file) {
        queryProduk += `, photo_produk = $5`;
        params.push(req.file.filename);
        queryProduk += ` WHERE id_produk_iklan = $6`;
        params.push(id);
      } else {
        queryProduk += ` WHERE id_produk_iklan = $5`;
        params.push(id);
      }

      await pool.query(queryProduk, params);

      // cek tipe kategori
      const cekRadio = await pool.query(`SELECT * FROM jadwal_produk_radio WHERE produk_id = $1`, [id]);
      const isRadio = cekRadio.rows.length > 0;

      if (isRadio) {
        const hariGabung = hariArray.join(",");
        await pool.query(
          `UPDATE jadwal_produk_radio 
           SET hari = $1, jam_mulai = $2, jam_selesai = $3 ,slot_penayangan = $4 
           WHERE produk_id = $5`,
          [hariGabung, jam_mulai, jam_selesai, slot_penayangan, id]
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
  });
};


export const getOnProgressVendor = async (req, res) => {
  try {
    const vendorId = req.user.id;

    const hasil = await pool.query(`
    SELECT
    p.id_pemesanan,
    p.jumlah_pemesanan,
    p.tanggal_pemesanan,
    p.status_pemesanan,

    u.full_name, u.nomor_tlp, u.email, u.photo_user,

    prod.nama_produk, prod.harga, prod.photo_produk,
    kat.tipe_kategori,

    -- SMS
    dp_sms.jenis_target AS sms_jenis_target,
    dps.masking, dps.target_umur, dps.tipe_device_penerima,
    dps.teks_iklan_sms, dps.tanggal_pengiriman_start, dps.tanggal_pengiriman_end, dps.jam_pengiriman,
    dps.nomor_penerima_bukti_tayang, dps.file_foto_mms,
    dps.file_nomor_sms_pdf, dps.alamat_target_sms, dps.dps_latitude, dps.dps_longitude,

    -- RADIO
    dpr.tanggal_tayang_pemesanan_radio,
    dpr.jam_tayang_pemesanan_radio,
    fpr.file_script,
    fpr.file_audio,

    -- Tambahkan ini DI SINI
    (
      SELECT json_agg(json_build_object(
        'tanggal', tanggal_tayang_pemesanan_radio,
        'jam', jam_tayang_pemesanan_radio
      )) FROM detail_pemesanan_radio
      WHERE id_pemesanan = p.id_pemesanan
    ) AS slot_penayangan_radio

  FROM pemesanan p
  JOIN produk_iklan prod ON prod.id_produk_iklan = p.produk_id
  JOIN users u ON u.id = p.user_id
  JOIN kategori kat ON kat.kategori_id = prod.kategori_id

  LEFT JOIN detail_produk_sms dp_sms ON dp_sms.produk_id = prod.id_produk_iklan
  LEFT JOIN detail_pemesanan_sms dps ON dps.id_pemesanan = p.id_pemesanan

  LEFT JOIN (
    SELECT DISTINCT ON (id_pemesanan) id_pemesanan, tanggal_tayang_pemesanan_radio, jam_tayang_pemesanan_radio
    FROM detail_pemesanan_radio
    ORDER BY id_pemesanan, tanggal_tayang_pemesanan_radio ASC
  ) dpr ON dpr.id_pemesanan = p.id_pemesanan

  LEFT JOIN file_pemesanan_radio fpr ON fpr.id_pemesanan = p.id_pemesanan

  WHERE prod.vendor_id = $1
    AND LOWER(p.status_pemesanan) NOT IN ('dibatalkan', 'selesai')
  ORDER BY p.tanggal_pemesanan DESC
`, [vendorId]);

    console.log(`✅ ${hasil.rowCount} pemesanan ditemukan untuk vendor ID ${vendorId}`);
    console.table(hasil.rows.map(p => ({
      id: p.id_pemesanan,
      produk: p.nama_produk,
      kategori: p.tipe_kategori,
      status: p.status_pemesanan,
      jenis_target: p.sms_jenis_target,
      tanggal: p.tanggal_pemesanan,
    })));

    hasil.rows.forEach((p, index) => {
      if (p.slot_penayangan_radio && Array.isArray(p.slot_penayangan_radio)) {
        console.log(`📅 Pemesanan ID ${p.id_pemesanan} - Slot Penayangan:`);

        p.slot_penayangan = p.slot_penayangan_radio.map((item) => {
          const jam = item.jam?.substring(0, 5); // "01:53"
          console.log(`- Tanggal: ${item.tanggal}, Jam: ${jam}`);
          return {
            title: `${jam} Tayang`,
            start: item.tanggal
          };
        });
      } else {
        console.log(`⚠️ Pemesanan ID ${p.id_pemesanan} tidak punya data slot penayangan`);
        p.slot_penayangan = [];
      }
    });
    res.render("dashVendor/dashboardVendor", {
      data: hasil.rows,
      partial: "dalam_progress",
      error: "",
      googleMapsApiKey: process.env.Maps_API
    });

  } catch (err) {
    console.error("❌ Gagal ambil data progress vendor:", err);
    res.status(500).send("Terjadi kesalahan saat mengambil data pemesanan vendor.");
  }
};


export const updateStatusPemesanan = async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;

  try {
    const validStatus = ["Menunggu Pembayaran", "Menunggu Penyesuaian", "Ditolak"];
    if (!validStatus.includes(status)) {
      return res.status(400).json({ success: false, message: "Status tidak valid." });
    }

    if (status === "Menunggu Penyesuaian") {
      if (!note || note.trim() === "") {
        return res.status(400).json({ success: false, message: "Alasan revisi wajib diisi." });
      }

      await pool.query(
        `UPDATE pemesanan SET status_pemesanan = $1, note_pemesanan_vendor = $2 WHERE id_pemesanan = $3`,
        [status, note, id]
      );

    } else if (status === "Menunggu Pembayaran") {
      const result = await pool.query(`
        SELECT u.email, u.full_name, u.id as user_id,
               pi.nama_produk, k.tipe_kategori
        FROM pemesanan p
        JOIN users u ON u.id = p.user_id
        JOIN produk_iklan pi ON pi.id_produk_iklan = p.produk_id
        JOIN kategori k ON k.kategori_id = p.kategori_id
        WHERE p.id_pemesanan = $1
      `, [id]);

      const user = result.rows[0];
      if (!user) {
        return res.status(404).json({ success: false, message: "User tidak ditemukan." });
      }

      let jadwalText = "";

      if (user.tipe_kategori.toLowerCase() === "messaging") {
        // Ambil data jadwal SMS
        const smsResult = await pool.query(`
          SELECT tanggal_pengiriman_start, tanggal_pengiriman_end, jam_pengiriman
          FROM detail_pemesanan_sms
          WHERE id_pemesanan = $1
        `, [id]);

        const sms = smsResult.rows[0];
        const start = new Date(sms.tanggal_pengiriman_start).toLocaleDateString("id-ID");
        const end = new Date(sms.tanggal_pengiriman_end).toLocaleDateString("id-ID");
        const jam = sms.jam_pengiriman.slice(0, 5); // hh:mm

        jadwalText = (start === end)
          ? `${start} pukul ${jam}`
          : `${start} s/d ${end} pukul ${jam}`;

      } else if (user.tipe_kategori.toLowerCase() === "radio") {
        console.log("🔍 Deteksi kategori radio, id_pemesanan:", id);

        const radioResult = await pool.query(`
        SELECT tanggal_tayang_pemesanan_radio, jam_tayang_pemesanan_radio
        FROM detail_pemesanan_radio
        WHERE id_pemesanan = $1
        ORDER BY tanggal_tayang_pemesanan_radio ASC, jam_tayang_pemesanan_radio ASC
        `, [id]);

        console.log("📦 Hasil query radio (detail_pemesanan_radio):", radioResult.rows);

        const jadwalList = radioResult.rows.map(r => {
          const tanggal = new Date(r.tanggal_tayang_pemesanan_radio).toLocaleDateString("id-ID");
          const jam = r.jam_tayang_pemesanan_radio?.slice(0, 5); // format ke "HH:mm"
          return `${tanggal} pukul ${jam}`;
        });

        jadwalText = jadwalList.length > 0 ? jadwalList.join("<br>") : "-";
      }

      // Update status dan tanggal_disetujui
      await pool.query(`
        UPDATE pemesanan 
        SET status_pemesanan = $1, tanggal_disetujui = NOW()
        WHERE id_pemesanan = $2
      `, [status, id]);

      // Buat token untuk akses link pembayaran
      const token = jwt.sign(
        { user_id: user.user_id, id_pemesanan: id, role: "klien" },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      const baseUrl = process.env.BASE_URL || "http://localhost:3000";
      const paymentLink = `${baseUrl}/pembayaran/${id}/email?token=${token}`;

      // 4. Kirim email ke user
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: 'Pemesanan Anda Disetujui - Silakan Lakukan Pembayaran',
        html: `
          <p>Halo ${user.full_name},</p>
          <p>Pemesanan Anda untuk produk <b>${user.nama_produk}</b> telah disetujui oleh vendor.</p>
          <p><b>Jadwal tayang:</b> ${jadwalText}</p>
          <p>Silakan melakukan pembayaran dalam waktu <b>24 jam</b> melalui link berikut:</p>
          <p><a href="${paymentLink}">${paymentLink}</a></p>
          <p>Terima kasih.</p>
        `
      });

    } else {
      await pool.query(
        `UPDATE pemesanan SET status_pemesanan = $1 WHERE id_pemesanan = $2`,
        [status, id]
      );
    }

    return res.json({
      success: true,
      message: `Status berhasil diubah menjadi "${status}".`,
      updatedStatus: status,
    });

  } catch (error) {
    console.error("❌ Gagal update status pemesanan:", error);
    return res.status(500).json({ success: false, message: "Gagal update status" });
  }
};



export const generateBuktiPDF = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT
        p.id_pemesanan,
        p.jumlah_pemesanan,
        p.tanggal_pemesanan,
        p.status_pemesanan,
        u.full_name, u.nomor_tlp, u.email,
        u.photo_user,
        prod.nama_produk, prod.harga, prod.photo_produk, dp.jenis_target, 
        kat.tipe_kategori,
        dps.teks_iklan_sms,
        dps.tanggal_pengiriman_start, dps.tanggal_pengiriman_end, dps.jam_pengiriman,
        dps.masking, dps.target_umur, dps.tipe_device_penerima,
        dps.nomor_penerima_bukti_tayang, dps.file_foto_mms,
        dps.file_nomor_sms_pdf, dps.alamat_target_sms, dps.dps_latitude, dps.dps_longitude,
        v.nama_toko_vendor
      FROM pemesanan p
      JOIN produk_iklan prod ON prod.id_produk_iklan = p.produk_id
      JOIN detail_pemesanan_sms dps ON dps.id_pemesanan = p.id_pemesanan
      JOIN users u ON u.id = p.user_id
      JOIN kategori kat ON kat.kategori_id = prod.kategori_id
      JOIN detail_produk_sms dp ON dp.produk_id = prod.id_produk_iklan
      JOIN users_vendor v ON v.id_vendor = prod.vendor_id
      WHERE p.id_pemesanan = $1
  `, [id]);

    if (!result.rows.length) {
      return res.status(404).send("Data pemesanan tidak ditemukan.");
    }

    const p = result.rows[0];
    const toBase64 = (filePath) => {
      const image = fs.readFileSync(filePath);
      const ext = path.extname(filePath).substring(1);
      return `data:image/${ext};base64,${image.toString("base64")}`;
    };
    const safeToBase64 = (filePath) => {
      try {
        if (!filePath) return null;
        const image = fs.readFileSync(filePath);
        const ext = path.extname(filePath).substring(1);
        return `data:image/${ext};base64,${image.toString("base64")}`;
      } catch (err) {
        console.warn("⚠️ Gagal baca file gambar:", filePath);
        return null;
      }
    };
    p.logo_base64 = toBase64(path.resolve("public/foto/logo_ngiklanmurah.png"));
    // Lokasi template PDF (pastikan kamu sudah punya pdf_template.ejs di folder views)
    const templatePath = path.resolve("views/pdf_template.ejs");
    p.local_photo_produk = toBase64(path.resolve("public/uploads/produk_img", p.photo_produk));
    p.local_foto_mms = safeToBase64(
      p.file_foto_mms ? path.resolve("public/uploads/sms_files", p.file_foto_mms) : null
    );
    const html = await ejs.renderFile(templatePath, { p });

    if (!html || html.trim() === "") {
      console.error("❌ HTML kosong setelah render.");
      return res.status(500).send("Template HTML kosong.");
    }

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });

    if (!pdfBuffer || pdfBuffer.length < 1000) {
      console.error("❌ PDF buffer kosong atau gagal dibuat.");
      return res.status(500).send("PDF gagal dibuat.");
    }
    await browser.close();

    res.setHeader("Content-Disposition", `attachment; filename=bukti_pemesanan_${id}.pdf`);
    res.contentType("application/pdf");
    res.end(pdfBuffer)

  } catch (err) {
    console.error("❌ Gagal generate PDF:", err);
    res.status(500).send("Gagal membuat PDF.");
  }
};

export const forgotPasswordVendor = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email wajib diisi.' });
    }

    const result = await pool.query(
      `SELECT * FROM users_vendor WHERE email_vendor = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Email tidak ditemukan untuk akun internal.' });
    }

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id_vendor, email: user.email_vendor },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    )

    // const resetURL = `http://localhost:3000/vendor/reset-password?token=${token}`;
    const resetURL = `skripsi-v3-coba.up.railway.app/vendor/reset-password?token=${token}`;
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: user.email_vendor,
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

export const vertifikasi_vendor = async (req, res) => {
  const { token } = req.query;

  console.log("🔑 Token diterima:", token);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ Token berhasil diverifikasi:", decoded);

    const { id } = decoded;
    console.log("🆔 ID dari token:", id);

    const updateRes = await pool.query(
      "UPDATE users_vendor SET vertifikasi_vendor = 'sudah terverifikasi' WHERE id_vendor = $1 RETURNING *",
      [id]
    );

    if (updateRes.rowCount === 0) {
      console.warn("⚠️ Tidak ada user yang diupdate. ID mungkin salah atau tidak ditemukan.");
      return res.status(404).send("Pengguna tidak ditemukan.");
    }

    console.log("📝 Data vendor setelah update:", updateRes.rows[0]);

    // Tampilkan form atur password
    res.render('Email/setPassword_dan_Konfirmasi_email', {
      token: token
    });

  } catch (err) {
    console.error("❌ Error verifikasi token vendor:", err);
    res.status(400).send("❌ Link tidak valid atau sudah kadaluarsa.");
  }
};

// upload bukti tayang start
const storageBT = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'public/uploads/bukti_tayang/';
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + unique + ext);
  }
});

const uploadBT = multer({
  storage: storageBT,
  // limits: { fileSize: 10 * 1024 * 1024 }, // max 10MB per file
});

export const uploadBuktiTayangMiddleware = uploadBT.fields([
  { name: 'dokumen_radio', maxCount: 10 },
  { name: 'audio_radio', maxCount: 10 },
  { name: 'dokumen_sms', maxCount: 10 }
]);

export const handleUploadBuktiTayang = (req, res) => {
  uploadBuktiTayangMiddleware(req, res, async function (err) {
    const { id_pemesanan } = req.params;

    if (err) {
      console.error("❌ Upload error:", err);
      return res.status(400).send("❌ Gagal mengunggah file.");
    }

    const allFiles = [
      ...(req.files?.['dokumen_radio'] || []),
      ...(req.files?.['audio_radio'] || []),
      ...(req.files?.['dokumen_sms'] || [])
    ];

    if (allFiles.length === 0) {
      return res.status(400).send("❌ Tidak ada file yang diunggah.");
    }

    try {
      // Simpan file ke tabel bukti_tayang
      for (let file of allFiles) {
        await pool.query(
          "INSERT INTO bukti_tayang (id_pemesanan, file_bukti_tayang) VALUES ($1, $2)",
          [id_pemesanan, file.filename]
        );
      }

      // Ubah status_pemesanan ke "Menunggu Konfirmasi Klien"
      await pool.query(
        "UPDATE pemesanan SET status_pemesanan = 'Menunggu Konfirmasi Klien' WHERE id_pemesanan = $1",
        [id_pemesanan]
      );

      console.log(`✅ ${allFiles.length} file berhasil diunggah untuk pemesanan ${id_pemesanan}`);
      res.redirect("/vendor/ongoing");
    } catch (err) {
      console.error("❌ Gagal simpan ke database:", err);
      res.status(500).send("Terjadi kesalahan saat menyimpan ke database.");
    }
  });
};


// pengaturan akun vendor
export const getHalamanPengaturanVendor = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query("SELECT * FROM users_vendor WHERE id_vendor = $1", [userId]);
    const user = result.rows[0];
    console.log("📝 Data vendor:", result.rows[0]);

    res.render("dashVendor/dashboardVendor", {
      partial: 'pengaturan_akun_vendor',
      error: "",
      data: "",
      user
    });
  } catch (err) {
    console.error("❌ Gagal ambil data user:", err);
    res.status(500).send("Terjadi kesalahan.");
  }
};

export const updatePasswordVendor = async (req, res) => {
  const userId = req.user.id;
  const { old_password, new_password } = req.body;

  try {
    const user = await pool.query(`SELECT password_vendor FROM users_vendor WHERE id_vendor = $1`, [userId]);
    if (user.rowCount === 0) return res.json({ success: false, message: "User tidak ditemukan" });

    const isMatch = await bcrypt.compare(old_password, user.rows[0].password_vendor);
    if (!isMatch) return res.json({ success: false, message: "Password lama salah" });

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query(`UPDATE users_vendor SET password_vendor = $1 WHERE id_vendor = $2`, [hashed, userId]);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Gagal update password:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateProfilVendor = async (req, res) => {
  const userId = req.user.id;
  const { full_name, nomor_tlp } = req.body;

  try {
    await pool.query(
      `UPDATE users_vendor SET nama_toko_vendor = $1, no_telepon_vendor = $2  WHERE id_vendor = $3`,
      [full_name, nomor_tlp, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Gagal update profil:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// untuk foto profile
const storagePhotoVendor = multer.diskStorage({
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
const fileFilterVendor = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Hanya file gambar (jpg, jpeg, png) yang diperbolehkan"), false);
  }
};

// Export middleware
const uploadPhotoVendor = multer({ storage: storagePhotoVendor, fileFilter: fileFilterVendor }).single("foto_user");


export const updateFotoVendor = async (req, res) => {
  uploadPhotoVendor(req, res, async function (err) {
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
      const { rows } = await pool.query(`SELECT photo_vendor FROM users_vendor WHERE id_vendor = $1`, [userId]);
      const fotoLama = rows[0]?.photo_vendor;
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
        await pool.query(`UPDATE users_vendor SET photo_vendor = $1 WHERE id_vendor = $2`, [fotoBaru, userId]);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("❌ Gagal update foto:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });
};


