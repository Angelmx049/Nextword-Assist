const bcrypt = require('bcrypt');

const generarPassword = async () => {
  const passwordPlano = 'admin123';
  const saltRounds = 10;

  const passwordEncriptado = await bcrypt.hash(passwordPlano, saltRounds);

  console.log('Contraseña encriptada:');
  console.log(passwordEncriptado);
};

generarPassword();