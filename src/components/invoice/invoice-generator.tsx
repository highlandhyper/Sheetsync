
'use client';

import { useState, useMemo, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, PlusCircle, Printer } from 'lucide-react';

interface LineItem {
  id: number;
  description: string;
  quantity: number;
  price: number;
}

export function InvoiceGenerator() {
  const [invoiceNumber, setInvoiceNumber] = useState('INV-001');
  const [customerName, setCustomerName] = useState('CASH');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [salesperson, setSalesperson] = useState('');
  const [job, setJob] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [discount, setDiscount] = useState(0);

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: 1, description: '', quantity: 1, price: 0 },
  ]);

  const subtotal = useMemo(() => {
    return lineItems.reduce((acc, item) => acc + item.quantity * item.price, 0);
  }, [lineItems]);
  
  const total = useMemo(() => subtotal - discount, [subtotal, discount]);

  const handleLineItemChange = (id: number, field: keyof Omit<LineItem, 'id'>, value: string | number) => {
    setLineItems(
      lineItems.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { id: Date.now(), description: '', quantity: 1, price: 0 }]);
  };

  const removeLineItem = (id: number) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8">
      {/* Invoice Header Form */}
      <Card className="noprint">
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
          <CardDescription>Enter the main details for the invoice.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           <div className="space-y-2">
            <Label htmlFor="invoiceNumber">Invoice Number</Label>
            <Input id="invoiceNumber" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer Name (TO:)</Label>
            <Input id="customerName" placeholder="e.g., CASH" value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoiceDate">Invoice Date</Label>
            <Input id="invoiceDate" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input id="dueDate" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
           <div className="space-y-2">
            <Label htmlFor="salesperson">Salesperson</Label>
            <Input id="salesperson" value={salesperson} onChange={e => setSalesperson(e.target.value)} />
          </div>
           <div className="space-y-2">
            <Label htmlFor="job">Job</Label>
            <Input id="job" value={job} onChange={e => setJob(e.target.value)} />
          </div>
           <div className="space-y-2">
            <Label htmlFor="paymentTerms">Payment Terms</Label>
            <Input id="paymentTerms" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} />
          </div>
           <div className="space-y-2">
            <Label htmlFor="discount">Discount</Label>
            <Input id="discount" type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} />
          </div>
        </CardContent>
      </Card>

      {/* Line Items Form */}
      <Card className="noprint">
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
          <CardDescription>Add products or services to the invoice.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {lineItems.map((item, index) => (
              <div key={item.id} className="flex flex-col sm:flex-row gap-2 items-start">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-grow w-full">
                  <div className="space-y-1">
                    {index === 0 && <Label className="sm:hidden">Description</Label>}
                    <Input placeholder="Item Description" value={item.description} onChange={e => handleLineItemChange(item.id, 'description', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                     {index === 0 && <Label className="sm:hidden">Quantity</Label>}
                    <Input type="number" placeholder="Qty" value={item.quantity} onChange={e => handleLineItemChange(item.id, 'quantity', Number(e.target.value))} className="text-right" min="0" />
                  </div>
                  <div className="space-y-1">
                     {index === 0 && <Label className="sm:hidden">Price</Label>}
                    <Input type="number" placeholder="Price" value={item.price} onChange={e => handleLineItemChange(item.id, 'price', Number(e.target.value))} className="text-right" min="0" step="0.01" />
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeLineItem(item.id)} disabled={lineItems.length <= 1} className="text-destructive h-10 w-10 mt-1 sm:mt-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={addLineItem} className="mt-4">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Item
          </Button>
        </CardContent>
      </Card>
      
      <div className="flex justify-end gap-2 noprint">
        <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print Invoice</Button>
      </div>

      {/* Printable Invoice Preview */}
        <div className="printable-area bg-white text-black p-8 max-w-4xl mx-auto ring-1 ring-gray-200">
            <header className="mb-8">
                <h1 className="text-3xl font-sans font-bold text-blue-800 tracking-wider">HIGHLAND HYPERMARKET</h1>
                <div className="mt-4 flex justify-between items-end border-b-2 border-green-500 pb-2">
                    <div>
                        <p className="text-sm">DATE: <span className="font-mono">{invoiceDate ? new Date(invoiceDate + 'T00:00:00').toLocaleDateString('en-GB') : ''}</span></p>
                        <p className="text-sm mt-2">INVOICE# <span className="text-red-500 font-mono">{invoiceNumber}</span></p>
                    </div>
                    <p className="text-sm">TO: <span className="text-red-500 font-mono">{customerName}</span></p>
                </div>
                 <h2 className="text-center font-bold mt-2">INVOICE</h2>
            </header>

            <section className="mb-4 text-sm">
                <div className="flex border-2 border-green-500">
                    <div className="w-1/3 p-1 border-r-2 border-green-500">
                        <p className="font-bold">SALESPERSON</p>
                        <p className="font-mono h-6">{salesperson}</p>
                    </div>
                    <div className="w-1/3 p-1 border-r-2 border-green-500">
                        <p className="font-bold">JOB</p>
                        <p className="font-mono h-6">{job}</p>
                    </div>
                    <div className="w-1/3 p-1">
                        <p className="font-bold">PAYMENT TERMS</p>
                        <p className="font-mono h-6">{paymentTerms}</p>
                    </div>
                </div>
            </section>
            
            <section>
                <table className="w-full text-sm invoice-table">
                    <thead>
                        <tr className="border-2 border-green-500">
                            <th className="w-1/6 p-1 text-left font-bold border-r-2 border-green-500">QTY</th>
                            <th className="w-1/2 p-1 text-left font-bold border-r-2 border-green-500">DESCRIPTION</th>
                            <th className="w-1/6 p-1 text-left font-bold border-r-2 border-green-500">PRICE</th>
                            <th className="w-1/6 p-1 text-left font-bold">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...lineItems, ...Array(Math.max(0, 15 - lineItems.length)).fill(null)].map((item, index) => (
                             <tr key={item ? item.id : `empty-${index}`} className="border-x-2 border-green-500">
                                <td className="p-1 border-r-2 border-green-500 font-mono">{item?.quantity || ''}</td>
                                <td className="p-1 border-r-2 border-green-500 font-mono">{item?.description || ''}</td>
                                <td className="p-1 border-r-2 border-green-500 font-mono">{item ? item.price.toFixed(2) : ''}</td>
                                <td className="p-1 font-mono">{item ? (item.quantity * item.price).toFixed(2) : ''}</td>
                            </tr>
                        ))}
                         <tr className="border-2 border-green-500">
                            <td className="p-1 border-r-2 border-green-500 h-6"></td>
                            <td className="p-1 border-r-2 border-green-500"></td>
                            <td className="p-1 border-r-2 border-green-500"></td>
                            <td className="p-1"></td>
                        </tr>
                    </tbody>
                </table>
            </section>
            
            <section className="mt-4 flex justify-between">
                <div>
                    <p className="font-bold">DISCOUNT</p>
                    <p className="font-mono text-lg">{discount > 0 ? discount.toFixed(2) : ''}</p>
                </div>
                <div className="w-1/3">
                    <div className="flex justify-between border-2 border-green-500 p-1">
                        <span className="font-bold">GR.</span>
                        <span className="font-mono">{total.toFixed(2)}</span>
                    </div>
                </div>
            </section>

            <footer className="mt-20 flex justify-between text-sm">
                <div>
                    <p className="border-t border-black pt-1">Customer signature</p>
                </div>
                <div>
                    <p className="border-t border-black pt-1">For HIGHLAND</p>
                </div>
            </footer>
      </div>
    </div>
  );
}
