// Validates req.body with a zod schema and replaces it with the clean result.
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return res.status(400).json({
        error: first?.message || 'Invalid input',
        field: first?.path?.join('.') || undefined,
      });
    }
    req.valid = parsed.data;
    return next();
  };
}

module.exports = { validate };
