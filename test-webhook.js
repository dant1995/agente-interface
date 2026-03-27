
const url = 'https://n8n-n8n.sd8jyi.easypanel.host/webhook/pedidos';
const data = { action: 'get_orders' };

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
.then(res => res.json())
.then(json => {
  let items = [];
  if (Array.isArray(json)) items = json;
  else if (json && typeof json === 'object') {
    const found = Object.values(json).find(val => Array.isArray(val));
    if (found) items = found;
    else items = [json];
  }
  
  const targets = ['Elcio de jesus verissimo', 'Nicholas de Marchi', 'Rosinalva santos almeida'];
  targets.forEach(name => {
    const item = items.find(i => String(Object.values(i)).includes(name));
    if (item) {
      console.log(`--- ${name} ---`);
      console.log('camisetas prontas:', item['camisetas prontas']);
      console.log('Entregue?:', item['Entregue?']);
      console.log('Pago?:', item['Pago?']);
    } else {
      console.log(`--- ${name} NOT FOUND ---`);
    }
  });
})
.catch(err => console.error(err));
