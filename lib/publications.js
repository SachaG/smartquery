var fieldArrayToSpecifier = function (fieldArray) {
  return _.object(fieldArray, fieldArray.map(function (f) {return 1}));
}

Meteor.startup(function () {
  
  // get all collections
  var collections = Mongo.Collection.getAll();

  collections.forEach(function (collection) {

    var collection = collection.instance;
    var rules = SmartQuery.rules[collection._name];

    // only proceed if collection has rules defined
    if (rules) {

      // for each collection, create a publication
      Meteor.publish(SmartQuery.getPublicationName(collection), function (id, selector, options) {
        
        var publication = this;

        var validSelector = _.clone(selector);
        var validOptions = _.clone(options);
        delete validOptions.fields;

      
        if (typeof rules === "undefined" || rules.length === 0) {
          throw new Error("You must specify a rule for collection \""+collection._name+"\"");
        }

        rules.forEach(function (rule) {

          // Fields
          if (typeof rule.fields !== "undefined") {
            var ruleFields = rule.fields.bind(publication)();
            if (!!options.fields) {
              // use intersection of options provided and rule fields
              validOptions.fields = fieldArrayToSpecifier(_.intersection(_.keys(options.fields), ruleFields));
            } else {
              // use rule fields
              validOptions.fields = fieldArrayToSpecifier(ruleFields);
            }
          }

          // Filter
          if (typeof rule.filter !== "undefined") {
            var validIds = [];
            collection.find().forEach(function (document) {

              // bind filter function to publication's `this` so we can call `this.userId`
              var isValid = rule.filter.bind(publication, document)();
              if (isValid) {
                // if the document is valid, push its `_id` to `validIds`
                validIds.push(document._id);
              }

            });
            validSelector = {$and: [validSelector, {_id: {$in: validIds}}]}          
          }

        });

        // publish count of total number of items matching the selector (without limit)
        var unlimitedOptions = _.clone(options);
        delete unlimitedOptions.limit;
        Counts.publish(this, id, collection.find(validSelector, unlimitedOptions));
        
        return collection.find(validSelector, validOptions);
      });

    }

  });

});