const charmap = {
  À: "A",
  Á: "A",
  Â: "A",
  Ã: "A",
  Ä: "A",
  Å: "A",
  Æ: "AE",
  Ç: "C",
  È: "E",
  É: "E",
  Ê: "E",
  Ë: "E",
  Ì: "I",
  Í: "I",
  Î: "I",
  Ï: "I",
  Ð: "D",
  Ñ: "N",
  Ò: "O",
  Ó: "O",
  Ô: "O",
  Õ: "O",
  Ö: "O",
  Ő: "O",
  Ø: "O",
  Ù: "U",
  Ú: "U",
  Û: "U",
  Ü: "U",
  Ű: "U",
  Ý: "Y",
  Þ: "TH",
  ß: "ss",
  à: "a",
  á: "a",
  â: "a",
  ã: "a",
  ä: "a",
  å: "a",
  æ: "ae",
  ç: "c",
  è: "e",
  é: "e",
  ê: "e",
  ë: "e",
  ì: "i",
  í: "i",
  î: "i",
  ï: "i",
  ð: "d",
  ñ: "n",
  ò: "o",
  ó: "o",
  ô: "o",
  õ: "o",
  ö: "o",
  ő: "o",
  ø: "o",
  ù: "u",
  ú: "u",
  û: "u",
  ü: "u",
  ű: "u",
  ý: "y",
  þ: "th",
  ÿ: "y",
}

const autorized = (c) => {
  const charCode = c.charCodeAt(0)
  return (
    (charCode >= 48 && charCode <= 57) ||
    (charCode >= 65 && charCode <= 90) ||
    (charCode >= 97 && charCode <= 122)
  )
}

const mapCharacter = (character) =>
  character in charmap
    ? charmap[character]
    : autorized(character)
    ? character
    : ""

// normalise une chaine de caractères en gardant uniquement les lettres et les chiffres, et en mappant les lettres vers la version majuscule sans accent
module.exports = (arg) => {
  if (typeof arg === "number") {
    arg = arg + ""
  }
  if (typeof arg !== "string") return ""
  return arg.split("").map(mapCharacter).join("").toUpperCase()
}
