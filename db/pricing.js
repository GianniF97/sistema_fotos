/**
 * NICOLAS TECHEIRA FOTOGRAFÍAS — REGLAS CENTRALIZADAS DE PRECIOS Y DESCUENTOS
 * Centraliza las escalas de descuento por volumen y paquetes para evitar inconsistencias
 * entre frontend y servidor. Todos los cálculos matemáticos se realizan en centavos enteros.
 */

const PRICING_CONFIG = {
    MAX_ITEMS_PER_ORDER: 200,
    CURRENCY: 'ARS',
    TIERS: [
        { minPhotos: 20, discountRate: 0.35, label: 'Pack Colección Completa (35% OFF)' },
        { minPhotos: 10, discountRate: 0.25, label: 'Pack Selección Especial (25% OFF)' },
        { minPhotos: 5,  discountRate: 0.15, label: 'Pack 5 Recuerdos (15% OFF)' }
    ],
    FULL_ALBUM_TIER: {
        discountRate: 0.35,
        label: 'Pack Colección Completa (35% OFF)'
    }
};

/**
 * Calcula los totales y descuentos autoritativos en centavos enteros
 * @param {Array<{albumPrice: number, id: number}>} photoItems 
 * @param {boolean} isFullAlbum 
 */
function calculateOrderPricing(photoItems, isFullAlbum = false) {
    let subtotalCents = 0;
    for (const item of photoItems) {
        const rawPrice = Number(item.albumPrice !== undefined ? item.albumPrice : item.price);
        if (isNaN(rawPrice) || rawPrice < 0) {
            throw new Error(`Precio inválido para el ítem con ID ${item.id}`);
        }
        const priceCents = Math.round(rawPrice * 100);
        subtotalCents += priceCents;
    }

    const count = photoItems.length;
    let selectedTier = null;

    if (isFullAlbum) {
        selectedTier = PRICING_CONFIG.FULL_ALBUM_TIER;
    } else {
        for (const tier of PRICING_CONFIG.TIERS) {
            if (count >= tier.minPhotos) {
                selectedTier = tier;
                break;
            }
        }
    }

    const discountRate = selectedTier ? selectedTier.discountRate : 0;
    const discountLabel = selectedTier ? selectedTier.label : 'Precio regular';

    const discountCents = Math.round(subtotalCents * discountRate);
    const totalCents = Math.max(0, subtotalCents - discountCents);

    return {
        count,
        subtotalCents,
        discountCents,
        totalCents,
        subtotal: Number((subtotalCents / 100).toFixed(2)),
        discountAmount: Number((discountCents / 100).toFixed(2)),
        totalAmount: Number((totalCents / 100).toFixed(2)),
        discountRate,
        discountLabel
    };
}

module.exports = {
    PRICING_CONFIG,
    calculateOrderPricing
};
