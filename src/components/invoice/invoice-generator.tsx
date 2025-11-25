
'use client';

import { useState, useMemo, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, PlusCircle, Printer, FileDown } from 'lucide-react';

interface LineItem {
  id: number;
  description: string;
  quantity: number;
  price: number;
}

export function InvoiceGenerator() {
  const [invoiceNumber, setInvoiceNumber] = useState('INV-001');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: 1, description: '', quantity: 1, price: 0 },
  ]);
  const [notes, setNotes] = useState('');
  const [companyName, setCompanyName] = useState('Your Company Name');
  const [companyAddress, setCompanyAddress] = useState('123 Main Street, Anytown, USA');

  const subtotal = useMemo(() => {
    return lineItems.reduce((acc, item) => acc + item.quantity * item.price, 0);
  }, [lineItems]);

  const taxRate = 0.08; // Example tax rate: 8%
  const tax = useMemo(() => subtotal * taxRate, [subtotal, taxRate]);
  const total = useMemo(() => subtotal + tax, [subtotal, tax]);

  const handleLineItemChange = (id: number, field: keyof Omit<LineItem, 'id'>, value: string) => {
    setLineItems(
      lineItems.map(item => {
        if (item.id === id) {
          if (field === 'quantity' || field === 'price') {
            return { ...item, [field]: Number(value) || 0 };
          }
          return { ...item, [field]: value };
        }
        return item;
      })
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
            <Label htmlFor="companyName">Your Company Name</Label>
            <Input id="companyName" value={companyName} onChange={e => setCompanyName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyAddress">Your Company Address</Label>
            <Input id="companyAddress" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} />
          </div>
           <div className="space-y-2">
            <Label htmlFor="invoiceNumber">Invoice Number</Label>
            <Input id="invoiceNumber" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer Name</Label>
            <Input id="customerName" placeholder="e.g., John Doe" value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>
           <div className="space-y-2">
            <Label htmlFor="customerAddress">Customer Address</Label>
            <Textarea id="customerAddress" placeholder="e.g., 456 Oak Avenue..." value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoiceDate">Invoice Date</Label>
            <Input id="invoiceDate" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input id="dueDate" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
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
                    <Input type="number" placeholder="Qty" value={item.quantity} onChange={e => handleLineItemChange(item.id, 'quantity', e.target.value)} className="text-right" min="0" />
                  </div>
                  <div className="space-y-1">
                     {index === 0 && <Label className="sm-hidden">Price</Label>}
                    <Input type="number" placeholder="Price" value={item.price} onChange={e => handleLineItemChange(item.id, 'price', e.target.value)} className="text-right" min="0" step="0.01" />
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
      
       <Card className="noprint">
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>Add any additional notes or payment instructions.</CardDescription>
        </CardHeader>
        <CardContent>
           <Textarea placeholder="Thank you for your business." value={notes} onChange={e => setNotes(e.target.value)} />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 noprint">
        <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print Invoice</Button>
      </div>

      {/* Printable Invoice Preview */}
      <div className="printable-area bg-card text-card-foreground shadow-lg rounded-lg p-8 ring-1 ring-border">
        {/* Header */}
        <header className="flex justify-between items-start mb-10">
          <div>
            <h2 className="text-2xl font-bold text-primary">{companyName}</h2>
            <p className="text-muted-foreground whitespace-pre-line">{companyAddress}</p>
          </div>
          <div className="text-right">
            <h1 className="text-4xl font-extrabold text-primary uppercase tracking-wider">Invoice</h1>
            <p className="text-muted-foreground mt-1"># {invoiceNumber}</p>
          </div>
        </header>

        {/* Customer & Dates */}
        <section className="grid grid-cols-2 gap-4 mb-10">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Bill To</h3>
            <p className="font-bold">{customerName || 'Customer Name'}</p>
            <p className="text-muted-foreground whitespace-pre-line">{customerAddress || 'Customer Address'}</p>
          </div>
          <div className="text-right">
            <div className="mb-4">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Invoice Date</p>
              <p className="font-medium">{invoiceDate ? new Date(invoiceDate).toLocaleDateString() : '---'}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Due Date</p>
              <p className="font-medium">{dueDate ? new Date(dueDate).toLocaleDateString() : '---'}</p>
            </div>
          </div>
        </section>

        {/* Line Items Table */}
        <section className="mb-10">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-1/2">Description</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.description || 'Not specified'}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">${item.price.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">${(item.quantity * item.price).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {lineItems.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No items added.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </section>

        {/* Totals */}
        <section className="flex justify-end mb-10">
          <div className="w-full max-w-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax ({ (taxRate * 100).toFixed(0) }%)</span>
              <span className="font-medium">${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-primary pt-2 border-t mt-2">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </section>

        {/* Footer Notes */}
        {notes && (
          <footer className="border-t pt-6">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</h4>
            <p className="text-muted-foreground text-sm whitespace-pre-line">{notes}</p>
          </footer>
        )}
      </div>
    </div>
  );
}
