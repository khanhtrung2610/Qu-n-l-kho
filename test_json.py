import json

# Test decimal number
data = json.loads('{"quantity": 1.5}')
print("Type of quantity:", type(data['quantity']))
print("Value:", data['quantity'])
print("Is int?", isinstance(data['quantity'], int))
print("Is float?", isinstance(data['quantity'], float))

# Test integer
data2 = json.loads('{"quantity": 5}')
print("Type of quantity (int):", type(data2['quantity']))
print("Value:", data2['quantity'])
print("Is int?", isinstance(data2['quantity'], int))
