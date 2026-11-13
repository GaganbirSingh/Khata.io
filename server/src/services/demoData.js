// Fictional sample data. Demo customers deliberately have NO phone numbers,
// so a reminder can never open a chat with a real person's number.
const SAMPLE = [
  { name: 'Ramesh Kumar', lines: [[18, 'udhaar', 650, 'Atta 10kg, tel'], [12, 'jama', 500, 'Cash'], [4, 'udhaar', 980, 'Chawal, daal, chini'], [1, 'udhaar', 120, 'Doodh, bread']] },
  { name: 'Sunita Devi', lines: [[15, 'udhaar', 800, 'Ghee, masale'], [3, 'jama', 800, 'UPI']] },
  { name: 'Harpreet Singh', lines: [[25, 'udhaar', 1240, 'Atta, sarson tel'], [9, 'jama', 600, 'Cash'], [1, 'nakad', 260, 'Biscuit, namkeen']] },
  { name: 'Imran Qureshi', lines: [[34, 'udhaar', 2100, 'Monthly ration'], [0, 'udhaar', 180, 'Sabun, chai patti']] },
  { name: 'Kavita Sharma', lines: [[6, 'udhaar', 450, 'Biscuit, namkeen'], [2, 'jama', 450, 'UPI']] },
  { name: 'Mohit Verma', lines: [[40, 'udhaar', 760, 'Cold drink crate'], [21, 'jama', 200, 'Cash'], [0, 'udhaar', 90, 'Anda']] },
  { name: 'Gurpreet Kaur', lines: [[7, 'udhaar', 320, 'Doodh, paneer'], [0, 'jama', 300, 'Cash']] },
  // Anil shows the 'paid on the spot' rule: he still owes the old ₹1,500
  // even though he bought and paid for ₹1,500 of goods today.
  { name: 'Anil Yadav', lines: [[36, 'udhaar', 1500, 'Gas cylinder advance'], [0, 'nakad', 1500, 'Atta, ghee']] },
];

module.exports = { SAMPLE };
