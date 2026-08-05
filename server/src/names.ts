import { randomInt } from 'node:crypto'

/** Mullvad-style device names: random Adjective + Animal, unique per account. */

export const ADJECTIVES = [
  'Able', 'Actual', 'Aged', 'Agile', 'Airy', 'Alert', 'Alpine', 'Amber', 'Ample', 'Ancient',
  'Aqua', 'Arch', 'Ardent', 'Artful', 'Astral', 'Atomic', 'August', 'Aureal', 'Autumn', 'Awake',
  'Azure', 'Baltic', 'Basic', 'Bay', 'Beaming', 'Bland', 'Blazing', 'Blissful', 'Blithe', 'Bold',
  'Bonny', 'Boreal', 'Bouncy', 'Brainy', 'Brave', 'Breezy', 'Brief', 'Bright', 'Brisk', 'Bronze',
  'Bubbly', 'Busy', 'Calm', 'Candid', 'Canny', 'Casual', 'Celestial', 'Chief', 'Chill', 'Chipper',
  'Chirpy', 'Chrome', 'Civic', 'Civil', 'Classy', 'Clever', 'Cloudy', 'Coastal', 'Cobalt', 'Comic',
  'Composed', 'Copper', 'Coral', 'Cordial', 'Cosmic', 'Crafty', 'Crimson', 'Crisp', 'Cryptic', 'Crystal',
  'Cubic', 'Curious', 'Dandy', 'Dapper', 'Daring', 'Dashing', 'Dawn', 'Deft', 'Dew', 'Digital',
  'Dizzy', 'Double', 'Dreamy', 'Driven', 'Dry', 'Dual', 'Dune', 'Dusk', 'Dusty', 'Eager',
  'Early', 'Earnest', 'Earthy', 'Easy', 'Ebony', 'Echo', 'Elder', 'Electric', 'Elegant', 'Emerald',
  'Epic', 'Equal', 'Ethereal', 'Even', 'Exact', 'Extra', 'Fabled', 'Fair', 'Famous', 'Fancy',
  'Fast', 'Feisty', 'Fierce', 'Fiery', 'Fine', 'Firm', 'First', 'Fleet', 'Floral', 'Fluent',
  'Flying', 'Foggy', 'Fond', 'Formal', 'Frank', 'Free', 'Fresh', 'Frosty', 'Funky', 'Funny',
  'Fuzzy', 'Gallant', 'Gentle', 'Genuine', 'Giddy', 'Gilded', 'Glad', 'Glassy', 'Gleaming', 'Global',
  'Glossy', 'Golden', 'Graceful', 'Grand', 'Grateful', 'Great', 'Green', 'Groovy', 'Handy', 'Happy',
  'Hardy', 'Harmonic', 'Hasty', 'Hazel', 'Heroic', 'Hidden', 'High', 'Hip', 'Holo', 'Honest',
  'Humble', 'Hyper', 'Icy', 'Ideal', 'Idle', 'Indigo', 'Inner', 'Iron', 'Ivory', 'Jade',
  'Jaunty', 'Jazzy', 'Jolly', 'Jovial', 'Joyful', 'Jumbo', 'Jumpy', 'Just', 'Keen', 'Kind',
  'Kindred', 'Lasting', 'Late', 'Leafy', 'Legal', 'Light', 'Limber', 'Lively', 'Local', 'Lofty',
  'Loyal', 'Lucid', 'Lucky', 'Lunar', 'Lush', 'Magic', 'Major', 'Mellow', 'Merry', 'Mighty',
  'Minty', 'Misty', 'Modern', 'Modest', 'Mystic', 'Nameless', 'Native', 'Neat', 'Nimble', 'Noble',
  'Northern', 'Nova', 'Olive', 'Onyx', 'Opal', 'Optimal', 'Orbital', 'Organic', 'Pacific', 'Patient',
  'Peachy', 'Pearl', 'Peppy', 'Perky', 'Plucky', 'Polar', 'Polite', 'Prime', 'Prompt', 'Proud',
  'Punchy', 'Pure', 'Quaint', 'Quick', 'Quiet', 'Quirky', 'Radiant', 'Rapid', 'Rare', 'Ready',
  'Regal', 'Rising', 'Roaming', 'Robust', 'Rosy', 'Round', 'Royal', 'Ruby', 'Rustic', 'Sable',
  'Sage', 'Sandy', 'Sapphire', 'Scarlet', 'Secret', 'Serene', 'Sharp', 'Shiny', 'Silent', 'Silky',
  'Silver', 'Sincere', 'Sleek', 'Slick', 'Sly', 'Smart', 'Smooth', 'Snappy', 'Snowy', 'Soaring',
  'Solar', 'Solid', 'Sonic', 'Southern', 'Spry', 'Stable', 'Starry', 'Steady', 'Stellar', 'Stoic',
  'Stormy', 'Striking', 'Strong', 'Sturdy', 'Suave', 'Subtle', 'Sunny', 'Super', 'Supreme', 'Suspect',
  'Swift', 'Tactful', 'Tame', 'Tan', 'Teal', 'Tender', 'Terrific', 'Tidal', 'Tidy', 'Timely',
  'Topaz', 'Tranquil', 'True', 'Trusty', 'Tundra', 'Twin', 'Ultra', 'Umber', 'Unique', 'Upbeat',
  'Urban', 'Valiant', 'Velvet', 'Verdant', 'Violet', 'Vital', 'Vivid', 'Vocal', 'Warm', 'Wary',
  'Wild', 'Willing', 'Windy', 'Winter', 'Wise', 'Witty', 'Wooden', 'Worthy', 'Zany', 'Zealous'
] as const

export const ANIMALS = [
  'Akita', 'Albatross', 'Alpaca', 'Ant', 'Anteater', 'Antelope', 'Armadillo', 'Axolotl', 'Badger', 'Barracuda',
  'Bat', 'Bear', 'Beaver', 'Bee', 'Beetle', 'Bison', 'Bobcat', 'Bongo', 'Bunny', 'Butterfly',
  'Camel', 'Capybara', 'Caracal', 'Cardinal', 'Caribou', 'Cat', 'Chameleon', 'Cheetah', 'Chinchilla', 'Chipmunk',
  'Cobra', 'Cockatoo', 'Condor', 'Cougar', 'Coyote', 'Crane', 'Cricket', 'Crow', 'Cub', 'Deer',
  'Dingo', 'Dolphin', 'Donkey', 'Dove', 'Dragonfly', 'Duck', 'Eagle', 'Echidna', 'Eel', 'Egret',
  'Elephant', 'Elk', 'Emu', 'Ermine', 'Falcon', 'Fawn', 'Ferret', 'Finch', 'Firefly', 'Flamingo',
  'Fox', 'Frog', 'Gazelle', 'Gecko', 'Gerbil', 'Gibbon', 'Giraffe', 'Goat', 'Goose', 'Gopher',
  'Gorilla', 'Grouse', 'Gull', 'Hamster', 'Hare', 'Hawk', 'Hedgehog', 'Heron', 'Hippo', 'Hornet',
  'Horse', 'Hound', 'Hummingbird', 'Husky', 'Hyena', 'Ibex', 'Ibis', 'Iguana', 'Impala', 'Jackal',
  'Jackdaw', 'Jaguar', 'Jay', 'Kangaroo', 'Kestrel', 'Kingfisher', 'Kitten', 'Kiwi', 'Koala', 'Koi',
  'Kudu', 'Ladybug', 'Lark', 'Lemming', 'Lemur', 'Leopard', 'Lion', 'Lizard', 'Llama', 'Lobster',
  'Loon', 'Lynx', 'Macaw', 'Magpie', 'Manatee', 'Mandrill', 'Mantis', 'Marmot', 'Marten', 'Meerkat',
  'Mole', 'Mongoose', 'Moose', 'Moth', 'Mouse', 'Mule', 'Narwhal', 'Newt', 'Nightingale', 'Ocelot',
  'Octopus', 'Okapi', 'Opossum', 'Oriole', 'Osprey', 'Ostrich', 'Otter', 'Owl', 'Ox', 'Panda',
  'Pangolin', 'Panther', 'Parrot', 'Peacock', 'Pelican', 'Penguin', 'Pheasant', 'Pigeon', 'Pika', 'Pony',
  'Porcupine', 'Puffin', 'Puma', 'Python', 'Quail', 'Quokka', 'Rabbit', 'Raccoon', 'Ram', 'Raven',
  'Reindeer', 'Rhino', 'Robin', 'Rooster', 'Sable', 'Salamander', 'Salmon', 'Seahorse', 'Seal', 'Serval',
  'Shark', 'Sheep', 'Shrew', 'Skunk', 'Sloth', 'Snail', 'Sparrow', 'Squid', 'Squirrel', 'Starling',
  'Stoat', 'Stork', 'Swan', 'Swift', 'Tanager', 'Tapir', 'Tiger', 'Toad', 'Tortoise', 'Toucan',
  'Trout', 'Tuna', 'Turkey', 'Turtle', 'Viper', 'Vole', 'Walrus', 'Wasp', 'Weasel', 'Whale',
  'Wolf', 'Wolverine', 'Wombat', 'Woodpecker', 'Wren', 'Yak', 'Zebra', 'Zebu'
] as const

export function randomName(): string {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)]
  const animal = ANIMALS[randomInt(ANIMALS.length)]
  return `${adjective} ${animal}`
}

export const NAME_POOL_SIZE = ADJECTIVES.length * ANIMALS.length
