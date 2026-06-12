"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { Search, SlidersHorizontal } from "lucide-react";

interface ShopItem {
  id: string;
  title: string;
  description?: string;
  brand?: string;
  size?: string;
  color?: string;
  condition?: string;
  price: number;
  photoUrls: string[];
  category?: { name: string };
  featuredOnline: boolean;
}

export default function ShopPage() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ search, sort });
      const res = await fetch(`/api/shop/items?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, sort]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Our Shop</h1>
          <div className="flex items-center gap-3 flex-1 max-w-lg">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${total} items...`}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-gray-500" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="newest">Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 rounded-xl aspect-square mb-3" />
                <div className="h-4 bg-gray-200 rounded mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg">No items found</p>
            <p className="text-sm mt-1">Try a different search</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {items.map((item) => (
              <div
                key={item.id}
                className="group cursor-pointer"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 mb-3">
                  {item.photoUrls[0] ? (
                    <img
                      src={item.photoUrls[0]}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                      No photo
                    </div>
                  )}
                  {item.featuredOnline && (
                    <div className="absolute top-2 left-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                      Featured
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-white text-gray-700 text-xs px-2 py-1 rounded-full shadow-sm font-medium">
                    {item.condition}
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2">{item.title}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-500">{item.brand || item.category?.name}</p>
                    <p className="font-bold text-gray-900">{formatCurrency(item.price)}</p>
                  </div>
                  {item.size && (
                    <p className="text-xs text-gray-400 mt-0.5">Size: {item.size}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
