const axios = require('axios');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const FTPClient = require('ftp');

require('dotenv').config();
/* 
// Configuración de WooCommerce
const wooConfig = {
  url: process.env.WC_API_URL,
  consumerKey: process.env.WC_CONSUMER_KEY,
  consumerSecret: process.env.WC_CONSUMER_SECRET,
};

console.log('URL de la API:', wooConfig.url);
console.log('Consumer Key:', wooConfig.consumerKey);
console.log('Consumer Secret:', wooConfig.consumerSecret);

// Función para obtener productos de WooCommerce
async function getWooCommerceProducts() {
  console.log('Haciendo GET a:', `${wooConfig.url}/products`);
  console.log('Autenticación:', {
    username: wooConfig.consumerKey,
    password: wooConfig.consumerSecret,
  });
  try {
    const response = await axios.get(`${wooConfig.url}/products`, {
      auth: {
        username: wooConfig.consumerKey,
        password: wooConfig.consumerSecret,
      },
    });

    console.log('Respuesta de la API:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error al obtener productos:', error.message);
    return [];
  }
}

// Ejecutar la función para verificar si la conexión funciona
(async () => {
  const products = await getWooCommerceProducts();
  console.log('Productos obtenidos:', products);
})();
*/

// Función para leer el archivo CSV con csv-parser
function readCSVWithCSVParser(filePath) {
  return new Promise((resolve, reject) => {
    const products = [];
    fs.createReadStream(filePath)
      .pipe(csv()) //csv-parser para leer el archivo CSV
      .on('data', (row) => {
        products.push(row);
      })
      .on('end', () => {
        console.log('CSV leído correctamente.', products.length);
        resolve(products);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

// Función para transformar los productos al formato de Google Merchant
function transformProductsForGoogle(products) {
  console.log(`Transformando ${products.length} productos`);

  // Para crear un slug para el link
  function createSlug(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  return products.map((product, index) => {
    console.log(`Transformando producto ${index + 1}:`, product);

    return {
      id: product.SKU || product.ID,
      title: product.Nombre,
      description: product['Descripción']
        ? product['Descripción'].replace(/(<([^>]+)>)/gi, '').slice(0, 200)
        : '', // Limpiar HTML y limitar a 200 caracteres
      availability: product['Inventario'] > 0 ? 'in_stock' : 'out_of_stock',
      price: product['Precio rebajado']?.trim()
        ? product['Precio rebajado']
        : product['Precio normal'],
      link: `https://www.cruzeirogomas.cl/producto/${createSlug(
        product.Nombre
      )}`,
      image_link: product.Imágenes ? product.Imágenes.split(',')[0] : '',
      brand: product.Etiquetas || 'Generic', // aquí la marca
      condition: 'new', // no encontré info sobre la condición del producto, asi que lo dejé así new
      identifier_exists: product.SKU ? 'yes' : 'no',
      additional_image_link: product.Imágenes
        ? product.Imágenes.split(',').slice(1).join(',')
        : '',
    };
  });
}

// Función para generar el archivo CSV
function generateCSV(data) {
  const fields = [
    'id',
    'title',
    'description',
    'availability',
    'price',
    'link',
    'image_link',
    'brand',
    'condition',
    'identifier_exists',
    'additional_image_link',
  ];
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(data);
  console.log('Contenido del CSV generado:', csv);

  const filePath = path.join(__dirname, 'productos_google_merchant.csv');
  fs.writeFileSync(filePath, csv);
  console.log(`Archivo CSV generado: ${filePath}`);
  return filePath;
}

// Función para subir el archivo al FTP de Google Merchant
function uploadToFTP(filePath) {
  const ftpConfig = {
    host: 'uploads.google.com', // Dirección del servidor FTP
    user: 'tu_usuario', // Reemplazar con el usuario FTP
    password: 'tu_contraseña', // Reemplazar con la contraseña FTP
  };

  const client = new FTPClient();

  client.on('ready', () => {
    client.put(filePath, 'productos_google_merchant.csv', (err) => {
      if (err) {
        console.error('Error al subir el archivo:', err);
        client.end();
        return;
      }
      console.log('Archivo subido correctamente a Google Merchant Center');
      client.end();
    });
  });

  client.connect(ftpConfig);
}

// Proceso principal
async function processCSV() {
  try {
    const products = await readCSVWithCSVParser(
      '' // aqui la ruta del archivo csv
    );

    console.log('Productos cargados desde el CSV:', products.length);

    // Limitar a los primeros 100 productos
    const limitedProducts = products.slice(0, 100);
    console.log('Productos limitados a 100:', limitedProducts.length);

    // Transformar los productos
    const transformedProducts = transformProductsForGoogle(limitedProducts);
    console.log('Productos transformados:', transformedProducts.length);

    // Generar el archivo CSV de salida
    const filePath = generateCSV(transformedProducts);

    // Subir el archivo al FTP de Google Merchant
    uploadToFTP(filePath);
  } catch (error) {
    console.error('Error al procesar el CSV:', error.message);
  }
}

// Ejecutar el proceso
processCSV();
