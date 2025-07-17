import jwt from "jsonwebtoken";


// untuk admin
export const authenticateRoleDashAdmin = (roles) => {
  return (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
      return res.redirect("/admin/login");
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!roles.includes(decoded.role)) {
        return res.status(403).send("Forbidden");
      }
      req.user = decoded; // Simpan data user ke req
      next();
    } catch (err) {
      res.clearCookie("token");
      res.redirect("/admin/login");
    }
  };
};


// untuk vendor
export const authenticateVendor = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.redirect("/vendor/login"); // kalau belum login, arah login
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // tempel data vendor ke request
    next(); // lanjut ke route
  } catch (err) {
    res.clearCookie("token"); // hapus cookie token yang rusak/expired
    return res.redirect("/vendor/login");
  }
};

// untuk web
export const authenticateRoleWeb = (roles) => {
  return (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
      return res.redirect("/login-user");
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!roles.includes(decoded.role)) {
        return res.redirect("/register");
      }
      req.user = decoded; // Simpan data user ke req
      next();
    } catch (err) {
      res.clearCookie("token");
      res.redirect("/login-user");
    }
  };
};

export const authenticatePembayaranHybrid = (req, res, next) => {
  const tokenCookie = req.cookies.token;
  const tokenQueryOrBody = req.body.token || req.query.token;

  // 🔐 Kalau ada token dari login (cookie)
  if (tokenCookie) {
    try {
      const decoded = jwt.verify(tokenCookie, process.env.JWT_SECRET);
      req.user = decoded;
      return next(); // ✅ Lolos dari login biasa
    } catch (err) {
      console.warn("❌ Token login tidak valid:", err);
      // lanjut cek token dari email
    }
  }

  // 📩 Cek token dari email
  if (tokenQueryOrBody) {
    try {
      const decoded = jwt.verify(tokenQueryOrBody, process.env.JWT_SECRET);
      req.user = {
        id: decoded.user_id,
        role: decoded.role,
      };
      return next(); // ✅ Lolos dari token email
    } catch (err) {
      return res.status(403).send("❌ Token dari email tidak valid atau kadaluarsa");
    }
  }

  // ❌ Tidak ada token sama sekali
  return res.status(401).send("❌ Tidak ada akses");
};


// untuk vendor masih belom di pakai dan perlu di sesuaikan
// export const authenticateRoleDashVendor = (roles) => {
//   return (req, res, next) => {
//     const token = req.cookies.token;
//     if (!token) {
//       return res.redirect("/vendor/login");
//     }

//     try {
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);
//       if (!roles.includes(decoded.role)) {
//         return res.status(403).send("Forbidden");
//       }
//       req.user = decoded; // Simpan data user ke req
//       next();
//     } catch (err) {
//       res.clearCookie("token");
//       res.redirect("/vendor/login");
//     }
//   };
// };

