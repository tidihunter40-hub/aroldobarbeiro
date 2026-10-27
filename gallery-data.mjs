export const defaultGallery = {
  intro: 'Uma nova versão de você começa aqui.',
  description: 'Soluções de prótese capilar desenvolvidas com cuidado, técnica e atenção ao seu estilo.',
  transformations: [],
  covers: {},
  works: {}
};

export const galleryCategories = ['cortes', 'visagismo', 'proteses', 'barbas', 'outros'];

export function validateGallery(input, allowedPhoto) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.transformations) || input.transformations.length > 12)
    throw Object.assign(new Error('Dados da galeria inválidos.'), { status: 400 });
  const intro = String(input.intro || '').trim();
  const description = String(input.description || '').trim();
  if (!intro || intro.length > 120 || !description || description.length > 360)
    throw Object.assign(new Error('Revise os textos da prótese capilar.'), { status: 400 });
  const transformations = input.transformations.map((item, index) => {
    const caption = String(item.caption || '').trim();
    const before = String(item.before || '');
    const after = String(item.after || '');
    if (!caption || caption.length > 90 || !allowedPhoto(before) || !allowedPhoto(after) || before === after)
      throw Object.assign(new Error(`Revise o antes e depois ${index + 1}. Use fotografias reais autorizadas.`), { status: 400 });
    return { caption, before, after };
  });
  const covers = {};
  const works = {};
  for (const category of galleryCategories) {
    const cover = input.covers?.[category];
    if (cover) {
      if (!allowedPhoto(cover)) throw Object.assign(new Error(`Capa inválida: ${category}.`), { status: 400 });
      covers[category] = cover;
    }
    const entries = input.works?.[category] || [];
    if (!Array.isArray(entries) || entries.length > 24) throw Object.assign(new Error(`Trabalhos inválidos: ${category}.`), { status: 400 });
    works[category] = entries.map(item => {
      const caption = String(item.caption || '').trim();
      const src = String(item.src || '');
      if (!caption || caption.length > 90 || !allowedPhoto(src))
        throw Object.assign(new Error(`Revise as fotografias reais de ${category}.`), { status: 400 });
      return { src, caption };
    });
  }
  return { intro, description, transformations, covers, works };
}
