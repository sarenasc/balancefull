const createHealthHandlers = (getPool) => {
  const handleHealthz = async (req, res) => {
    res.json({ ok: true });
  };

  const handleReadyz = async (req, res) => {
    try {
      const p = await getPool();
      await p.request().query("SELECT 1 AS ok");
      res.json({ ok: true });
    } catch (error) {
      res.status(503).json({ ok: false, error: error.message });
    }
  };

  return {
    handleHealthz,
    handleReadyz,
  };
};

module.exports = {
  createHealthHandlers,
};
