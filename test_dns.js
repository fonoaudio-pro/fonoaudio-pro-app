import dns from 'dns';

dns.resolve4('luaslntosuyzpolrxduv.supabase.co', (err, addresses) => {
  if (err) {
    console.error('Failed to resolve luaslntosuyzpolrxduv.supabase.co:', err);
  } else {
    console.log('luaslntosuyzpolrxduv.supabase.co resolved to:', addresses);
  }
});

dns.resolve4('db.luaslntosuyzpolrxduv.supabase.co', (err, addresses) => {
  if (err) {
    console.error('Failed to resolve db.luaslntosuyzpolrxduv.supabase.co:', err);
  } else {
    console.log('db.luaslntosuyzpolrxduv.supabase.co resolved to:', addresses);
  }
});
